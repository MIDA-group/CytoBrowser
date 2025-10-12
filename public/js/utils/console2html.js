/**
 * Clone console output to html-element (e.g. for phone)
 * From: https://stackoverflow.com/a/50773729
 */

function rewireLoggingToElement(eleLocator, eleOverflowLocator, autoScroll) {
    console.log('Rewiring console...');
    
    fixLoggingFunc('log');
    fixLoggingFunc('debug');
    fixLoggingFunc('warn');
    fixLoggingFunc('error');
    fixLoggingFunc('info');

    function fixLoggingFunc(name) {
        if (console['old' + name]) {
            console.warn(`console.old${name} already defined. Exiting to avoid infinte loop.`);
            return;
        }
        console['old' + name] = console[name];
        console[name] = function(...args) {
            const output = produceOutput(name, args);
            const eleLog = eleLocator();

            if (autoScroll) {
                const eleContainerLog = eleOverflowLocator();
                const isScrolledToBottom = eleContainerLog.scrollHeight - eleContainerLog.clientHeight <= eleContainerLog.scrollTop + 1;
                eleLog.innerHTML += output + "<br>";
                if (isScrolledToBottom) {
                    eleContainerLog.scrollTop = eleContainerLog.scrollHeight - eleContainerLog.clientHeight;
                }
            } else {
                eleLog.innerHTML += output + "<br>";
            }

            console['old' + name].apply(undefined, args);
        };
    }

    function produceOutput(name, args) {
        return args.reduce((output, arg) => {
            return output +
                "<span class=\"log-" + (typeof arg) + " log-" + name + "\">" +
                    (typeof arg === "object" && (JSON || {}).stringify ? JSON.stringify(arg) : arg) +
                "</span>&nbsp;";
        }, '');
    }
}

rewireLoggingToElement(
    () => document.getElementById("log"),
    () => document.getElementById("log-container"), true);

// setInterval(() => {
//   const method = (['log', 'debug', 'warn', 'error', 'info'][Math.floor(Math.random() * 5)]);
//   console[method](method, 'logging something...');
// }, 200);
