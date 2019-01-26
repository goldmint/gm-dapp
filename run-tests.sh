#! /bin/bash

# Please run this one in parallel:
#   ./node_modules/.bin/ganache-cli -p 8989 -l 100000000000

env ETH_NODE=http://localhost:8989 mocha --reporter spec -t 90000 -g "GOLDMINT POOL"
