'use strict'

/*
 * Created with @iobroker/create-adapter v2.3.0
 */

/*
 TODO
 ====
 - more data-types
*/

// The adapter-core module gives you access to the core ioBroker functions
// you need to create an adapter
const utils = require('@iobroker/adapter-core')

// Load your modules here, e.g.:
const DomiqClient = require('./lib/domiqClient.js')

let domiqClient

class Domiqbase extends utils.Adapter {
  /**
     * @param {Partial<utils.AdapterOptions>} [options={}]
     */
  constructor (options) {
    super({
      name: 'domiqbase'
    })
    this.on('ready', this.onReady.bind(this))
    this.on('stateChange', this.onStateChange.bind(this))
    this.on('unload', this.onUnload.bind(this))
    this.foreignStates = []
    this.stateMapping = []
    this.domiqClient = undefined
    this.me = undefined
    this.initialState = undefined
    this.initialStateAsked = undefined
  }

  /*
     * Is called when databases are connected and adapter received configuration.
     */
  async onReady () {
    // Initialize your adapter here
    const hostname = this.config.hostname
    const port = this.config.port
    const domiqWhitelist = []
    const self = this
    // this.me = 'system.adapter.' + this.name + '.' + this.instance
    this.me = this.name + '.' + this.instance

    // The adapters config (in the instance object everything under the attribute "native") is accessible via
    this.log.info('hostname: ' + hostname)
    this.log.info('port: ' + port)
    // read domiq regex table
    if (Array.isArray(this.config.domiqregex) && this.config.domiqregex.length) {
      this.config.domiqregex.forEach(function (item, index) {
        self.log.info('config  regex[' + index + ']: ' + JSON.stringify(item))
        if ('regex' in item && 'read' in item && 'write' in item && 'datatype' in item) {
          domiqWhitelist.push({
            regex: new RegExp(item.regex),
            read: item.read,
            write: item.write,
            datatype: item.datatype
          }
          )
        }
      })
    };

    // read foreign states table
    if (Array.isArray(this.config.regexentries) && this.config.regexentries.length) {
      this.config.regexentries.forEach(function (item, index) {
        if ('targetvariable' in item && 'regularexpression' in item && 'replacestring' in item) {
          self.log.info('config  foreign state[' + index + ']: ' + JSON.stringify(item))
          self.foreignStates.push({
            search: RegExp(item.regularexpression),
            replace: item.targetvariable + '.' + item.replacestring
          }
          )
        }
      })
    };

    // subscribe states
    this.subscribeStates(this.name + '.' + this.instance + '.*')

    // connect to domiq base, 1000ms ignore responses
    this.domiqClient = new DomiqClient({ host: hostname, port, responseTime: 1000 })
    this.domiqClient.connect()

    this.domiqClient.on('connect', function () {
      self.log.info('Domiq connected')
      this.initialState = true
      this.initialStateAsked = false
    })

    this.domiqClient.on('close', function () {
      self.log.info('Connection closed')
    })

    this.domiqClient.on('reconnectFailed', function () {
      self.log.warn('Domiq automatically reconnect failed, restarting ...')
      domiqClient.connect()
    })

    this.domiqClient.on('error', function (e) {
      self.log.error('error: ' + e)
    })

    this.domiqClient.on('event', async (address, value) => {
      if (this.initialState && !this.initialStateAsked) {
        setTimeout(() => {
          this.initialState = false
        }, 10000)
        this.domiqClient.writeRaw('?')
        this.initialStateAsked = true
      }

      // create objects for elements on the whitelist
      domiqWhitelist.forEach(async function (item, _) {
        let newValue
        const result = item.regex.exec(address)
        if (Array.isArray(result) && result.length) {
          await self.setObjectNotExistsAsync(address, {
            type: 'state',
            common: {
              name: address,
              type: item.datatype,
              role: 'value',
              read: item.read,
              write: item.write
            },
            native: {}
          })

          if (item.datatype === 'number') {
            newValue = parseFloat(Number(value).toFixed(11))
          } else if (item.datatype === 'boolean') {
            newValue = { 0: false, 1: true }[value]
          } else { // string
            newValue = value
          }
          await self.setStateAsync(address, { val: newValue, ack: true })
          self.subscribeStates(address)
        }
      })

      // write state changes from Base to the origin
      const result = this.stateMapping.find(e => e.target === address)
      if (result && !this.initialState) {
        // only proceed if a state mapping is available and 10sec after initialize the connection
        this.getForeignObject(result.origin, (errobj, obj) => {
          if (errobj) {
            this.log.error('error getForeignObject: ' + JSON.stringify(errobj))
          } else if (obj) {
            this.getForeignState(result.origin, (errstate, state) => {
              let newValue
              if (errstate) {
                this.log.error('error getforeignState: ' + JSON.stringify(errstate))
              } else if (state) {
                if (obj.common.write) {
                  if (obj.common.type === 'number') {
                    if (Number(state.val).toFixed(11) !== Number(value).toFixed(11)) {
                      newValue = { val: parseFloat(Number(value).toFixed(11)) }
                    }
                  } else if (obj.common.type === 'string') {
                    if (state.val !== value) {
                      newValue = { val: value }
                    }
                  } else if (obj.common.type === 'boolean') {
                    newValue = { val: { 0: false, 1: true }[value] }
                  }
                  if (newValue) {
                    this.setForeignStateAsync(result.origin, { val: newValue.val, ack: false })
                  }
                } else {
                  this.log.info('value ' + value + ' cannot be written because ' + result.origin + ' is read-only')
                }
              }
            })
          }
        })
      }
    })

    // read foreign objects table and subscribe foreign states
    // populate variables in the Base at start time
    if (Array.isArray(this.config.foreignobjects) && this.config.foreignobjects.length) {
      this.config.foreignobjects.forEach((item, index) => {
        if ('searchstring' in item) {
          this.log.info('config  foreign object[' + index + ']: ' + item.searchstring)
          this.subscribeForeignStates(item.searchstring)
          // initial populate Domiq Base
          this.getForeignStates(item.searchstring, (err, states) => {
            if (err) {
              this.log.error('error getForeignStates: ' + JSON.stringify(err))
            } else {
              Object.keys(states).forEach((item, _) => {
                this.onStateChange(item, states[item])
              })
            }
          })
        }
      })
    };
  }

  /**
     * Is called when adapter shuts down - callback has to be called under any circumstances!
     * @param {() => void} callback
     */
  onUnload (callback) {
    try {
      // Here you must clear all timeouts or intervals that may still be active
      // clearTimeout(timeout2);
      // ...
      // clearInterval(interval1);

      callback()
    } catch (e) {
      callback()
    }
  }

  /**
     * Is called if a subscribed state changes
     * @param {string} id
     * @param {ioBroker.State | null | undefined} state
     */

  onStateChange (id, state) {
    if (state) {
      if (state.ts === state.lc || this.initialState) {
        // The state was changed or connection initialzed
        let newValue
        const idLocation = id.split('.').filter((el, idx) => idx < 2).join('.')

        if (idLocation !== this.me) {
          // this progress an state update from a foreign state
          this.getForeignObject(id, (err, obj) => {
            if (err) {
              this.log.error('error getForeignObject: ' + JSON.stringify(err))
            } else if (obj) {
              // send state changes back to the Base (if the source of the state is a foreign adapter)
              let result = this.stateMapping.find(e => e.origin === id)
              if (!result) {
                this.foreignStates.forEach((item, _) => {
                  if (id.match(item.search)) {
                    result = { origin: id, target: id.replace(item.search, item.replace) }
                    this.stateMapping.push(result)
                    this.log.info('created new state mapping: ' + result.origin + ' > ' + result.target)
                  }
                })
              }
              // var result = this.foreignStates.find(e => e.origin === id);
              if (result) {
                if (obj.common.type === 'boolean') {
                  newValue = { false: '0', true: '1' }[state.val]
                } else {
                  newValue = state.val
                }
                // this.log.info(result.origin + ' > ' + result.target + ' = ' + newValue );
                this.domiqClient.write(result.target, newValue)
              }
            }
          })
        } else {
          // this progress an state update to a domiqbase state
          this.getObject(id, (err, obj) => {
            if (err) {
              this.log.error('error getObject: ' + JSON.stringify(err))
            } else if (obj) {
              if (state.ack === false) {
                if (obj.common.type === 'boolean') {
                  newValue = { false: '0', true: '1' }[state.val]
                } else {
                  newValue = state.val
                }
                this.domiqClient.write(id.split('.').filter((el, idx) => idx > 1).join('.'), newValue)
                this.setStateAsync(id, { val: state.val, ack: true })
              }
            }
          })
        }
      }
    } else {
      // The state was deleted
      this.log.info(`state ${id} deleted`)
    }
  }
}

if (require.main !== module) {
  // Export the constructor in compact mode
  /**
     * @param {Partial<utils.AdapterOptions>} [options={}]
     */
  module.exports = (options) => new Domiqbase(options)
} else {
  // otherwise start the instance directly
  new Domiqbase()
}
