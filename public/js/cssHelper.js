/**
 * Functions for generating different CSS components needed in other parts of the code.
 * "better solution" on https://stackoverflow.com/questions/1720320/how-to-dynamically-create-css-class-in-javascript-and-apply
 * @namespace cssHelper
 */
const cssHelper = (function() {
    function createCSSSelector (selector, style) {
        if (!document.styleSheets) return;
        if (document.getElementsByTagName('head').length == 0) return;
      
        var styleSheet,mediaType;
      
        if (document.styleSheets.length > 0) {
          for (var i = 0, l = document.styleSheets.length; i < l; i++) {
            if (document.styleSheets[i].disabled) 
              continue;
            var media = document.styleSheets[i].media;
            mediaType = typeof media;
      
            if (mediaType === 'string') {
              if (media === '' || (media.indexOf('screen') !== -1)) {
                styleSheet = document.styleSheets[i];
              }
            }
            else if (mediaType=='object') {
              if (media.mediaText === '' || (media.mediaText.indexOf('screen') !== -1)) {
                styleSheet = document.styleSheets[i];
              }
            }
      
            if (typeof styleSheet !== 'undefined') 
              break;
          }
        }
      
        if (typeof styleSheet === 'undefined') {
          var styleSheetElement = document.createElement('style');
          styleSheetElement.type = 'text/css';
          document.getElementsByTagName('head')[0].appendChild(styleSheetElement);
      
          for (i = 0; i < document.styleSheets.length; i++) {
            if (document.styleSheets[i].disabled) {
              continue;
            }
            styleSheet = document.styleSheets[i];
          }
      
          mediaType = typeof styleSheet.media;
        }
      
        if (mediaType === 'string') {
          for (var i = 0, l = styleSheet.rules.length; i < l; i++) {
            if(styleSheet.rules[i].selectorText && styleSheet.rules[i].selectorText.toLowerCase()==selector.toLowerCase()) {
              styleSheet.rules[i].style.cssText = style;
              return;
            }
          }
          styleSheet.addRule(selector,style);
        }
        else if (mediaType === 'object') {
          var styleSheetLength = (styleSheet.cssRules) ? styleSheet.cssRules.length : 0;
          for (var i = 0; i < styleSheetLength; i++) {
            if (styleSheet.cssRules[i].selectorText && styleSheet.cssRules[i].selectorText.toLowerCase() == selector.toLowerCase()) {
              styleSheet.cssRules[i].style.cssText = style;
              return;
            }
          }
          styleSheet.insertRule(selector + '{' + style + '}', styleSheetLength);
        }
    }

    return {
        createCSSSelector: createCSSSelector
    };
})();
