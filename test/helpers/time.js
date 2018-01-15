"use strict";

// Returns the time of the last mined block in seconds
function latestTime() {
  return web3.eth.getBlock('latest').timestamp;
};

// Increases blockchain time by the passed duration in seconds
function increaseTime(durationInSeconds) {
  const id = Date.now();

  return new Promise((resolve, reject) => {
    web3.currentProvider.sendAsync({
      jsonrpc: '2.0',
      method: 'evm_increaseTime',
      params: [durationInSeconds],
      id: id,
    }, err1 => {
      if (err1) {
        return reject(err1);
      }

      web3.currentProvider.sendAsync({
        jsonrpc: '2.0',
        method: 'evm_mine',
        id: id+1,
      }, (err2, res) => {
        return err2 ? reject(err2) : resolve(res)
      });
    });
  });
};

// Increases blockchain time to target time in seconds
function increaseTimeTo(targetTimeInSeconds) {
  let now = latestTime();
  if (targetTimeInSeconds < now) throw Error('Cannot increase current time to a moment in the past');
  let diff = targetTimeInSeconds - now;
  return increaseTime(diff);
}

// Conversion to seconds functions
const duration = {
  seconds: function(val) { return val},
  minutes: function(val) { return val * this.seconds(60) },
  hours:   function(val) { return val * this.minutes(60) },
  days:    function(val) { return val * this.hours(24) },
  weeks:   function(val) { return val * this.days(7) },
  years:   function(val) { return val * this.days(365)}
};

module.exports = {
    latestTime : latestTime,
    increaseTime : increaseTime,
    increaseTimeTo : increaseTimeTo,
    duration : duration
};