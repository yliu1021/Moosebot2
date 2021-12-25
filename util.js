function getCurrentDateString() {
    return (new Date()).toISOString() + ' ::';
}
__originalLog = console.log;
console.log = function () {
    const args = [].slice.call(arguments);
    __originalLog.apply(console.log, [getCurrentDateString()].concat(args));
};
