/**
 * Utility functions for anything with time and timeouts
 * @namespace timeUtils
 */
const timeUtils = (function() {
    /**
     * @param {*} fun Function to call after delay in range [0,maxWait]
     * @param {*} maxWait Default maximume waiting time before triggered, in ms
     * @param {boolean} [ignoreDelayed=false] Ignore calls which would be delayed
     * @returns fun, Function to be executed with rate limitation, always called asynchronously 
     * fun(newWait[,args]), where newWait=null => maxWait from creation
     * fun.clearPending() => throw them away
     * fun.flush() => run pending now!
     */
    function rateLimit(fun,maxWait,ignoreDelayed=false) {
        let lastRun=0;
        let pending=0;
        let argsStore=undefined;
        function clearPending() {
            if (pending) {
                clearTimeout(pending);
                pending=0;
            }
        }
        function flush() { //run pending now!
            if (pending) {
                console.log('Flushrun!');
                clearPending();
                runFun();
            }
        }            
        function runFun() {
            fun(...argsStore);
            lastRun=Date.now();
            pending=0;
        }
        const retfun=(newWait, ...args) => {
            argsStore=args;
            if (newWait == null) {
                newWait=maxWait; //default wait
            }
            clearPending();
            if (newWait===0) { //immediate
                runFun();
            }
            else { 
                let delay=Math.max(0,lastRun+newWait-Date.now()); 
                //console.log(`Delay: ${delay}, MW: ${newWait}, LR:${lastRun}`);
                console.assert(delay<=newWait);
                if (delay>0) {
                    console.assert(!pending);
                    if (!ignoreDelayed) { //otherwise just ignore
                        pending=setTimeout(()=>runFun(),delay);
                    }
                }
                else {
                    runFun(); //no task switch
                }
            }
        }
        retfun.clearPending=clearPending;
        retfun.flush=flush;
        return retfun;
    }


    return {
        rateLimit
    };
})();
