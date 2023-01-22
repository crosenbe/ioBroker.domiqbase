![Logo](admin/domiqbase.png)
# ioBroker.domiqbase

[![NPM version](https://img.shields.io/npm/v/iobroker.domiqbase.svg)](https://www.npmjs.com/package/iobroker.domiqbase)
[![Downloads](https://img.shields.io/npm/dm/iobroker.domiqbase.svg)](https://www.npmjs.com/package/iobroker.domiqbase)
![Number of Installations](https://iobroker.live/badges/domiqbase-installed.svg)
![Current version in stable repository](https://iobroker.live/badges/domiqbase-stable.svg)

[![NPM](https://nodei.co/npm/iobroker.domiqbase.png?downloads=true)](https://nodei.co/npm/iobroker.domiqbase/)

## Domiq Base adapter for ioBroker

Domiq Base is home automation device to be used with LCN of the company Issendorff. The adapter will connect via tcp/4224 to the Domiq Base and provide the possibility to get data from the Base and to provide states to the Base. In both directions the objects or states are selected by a list of wildcards or regular expressions. ioBroker states will be published in the Domiq Base as variables. A set of regular expressen to search and a replacement string will ensure to map the ID's as preferred by the user.

### Populating ioBroker with Domiq Base states

To subscribe stated from the Domiq Base you have to create regular expressions to match the state ID's. A predefined set is enabled by default. You have to enable read or write permissions and to set the data-type which has to be used for the states in ioBroker. All values from the Base are received as string. Data will be converted based on the data-type setting in the configuration.  
#### Examples or a regular expressions ...
>- `^LCN\.relay\..*$`  
>(match states of all relays)  
>  
>- `^LCN\.relay\.[^\.]+\.[^\.]+\.1$`  
>(match first state of all relays)  
>  
>- `^LCN\.relay\.0\.[^\.]+\.*$`  
>(match states of all relays in segment 0)  
  
There is no syntax check implemented before commands will be sent to the Base.

### Control ioBroker states from the Base

Because only variables can be used to transfer data the state ID's of ioBroker will be mapped to variables in the Domiq Base. To have full control how this mapping will be done a bit regular expression is necessary again. On top a subscriber list has to be configured to avoid every information will be shared with the Base. The stated will be filtered by a two step approach. 

1. Based on the object search list the foreign states will be subscribed
2. Based on regular expressions a second filter is possible, the mapping is done with groups in the expressions and a replacement string

#### Examples of search strings
`zigbee.0.*.state`  
`zigbee.0.*.available`  
`zigbee.0.*.temperature`  
#### Examples of regular expressions and replacement strings
`zigbee\.0\.(.*)` -> iob.zigbee.$1  
  
In this configuration table it can be decided to store the value in MEM or VAR variables also.



## Changelog
<!--
    Placeholder for the next version (at the beginning of the line):
    ### **WORK IN PROGRESS**
-->

### **WORK IN PROGRESS**
- only progress state on real value change

### 1.0.2 (2023-01-22)
- push all subscribed objects to the base after connection lost and reconnect
- After connect and reconnect initialize all states but don't progress updates of state mappings the first 10 seconds to not override values of the foreign states
- temporary ignore Base response commands for 1sec after update to the same address was written to the Base (workaround because the Base send 2 responses at the moment)
- acknowledge state updates

### 1.0.1 (2023-01-21)
-   Smaller bugfixes
-   Code cleanup to pass all tests

### 1.0.0 (2023-01-21)
* (Claus Rosenberger) release changes

### 0.1.2 (2023-01-20)
* (Claus Rosenberger) initial release

## License
MIT License

Copyright (c) 2023 Claus Rosenberger <git@rocnet.de>

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
