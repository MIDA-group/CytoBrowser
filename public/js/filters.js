/**
 * Parsing and instantiation of filters that can be used to alter which
 * annotations are shown. Includes functionality for preprocessing an
 * annotation into a filterable object.
 * @namespace filters
 */
const filters = (function () {
    "use strict";

    const _tokenTypes = {
        and: Symbol("Intersection"),
        or: Symbol("Union"),
        not: Symbol("Negation"),
        eq: Symbol("Equality"),
        gt: Symbol("Greater than"),
        lt: Symbol("Less than"),
        key: Symbol("Key"),
        boolValue: Symbol("Boolean value"),
        stringValue: Symbol("String value"),
        numberValue: Symbol("Number value"),
        leftP: Symbol("Left parenthesis"),
        rightP: Symbol("Right parenthesis"),
        nullValue: Symbol("Null value")
    };

    const _tokenExp = /\s*(("[^"]*")|('[^']*')|([a-zA-Z]+)|(-?\d+(\.\d+)?)|[^\s\da-zA-Z])\s*/g;
    const _keyExp = /^[a-zA-Z]+\S*$/;
    const _boolValueExp = /^(false)|(true)$/;
    const _stringValueExp = /^(("[^"]*")|('[^']*'))$/;
    const _numberValueExp = /^-?\d+(\.\d+)?$/;
    const _nullValueExp = /^(null)$/;

    function _getTokenType(token) {
        switch (token) {
            case "AND":
            case "and":
                return _tokenTypes.and;
            case "OR":
            case "or":
                return _tokenTypes.or;
            case "NOT":
            case "not":
                return _tokenTypes.not;
            case "=":
            case "IS":
            case "is":
                return _tokenTypes.eq;
            case ">":
                return _tokenTypes.gt;
            case "<":
                return _tokenTypes.lt;
            case "(":
            case "[":
                return _tokenTypes.leftP;
            case ")":
            case "]":
                return _tokenTypes.rightP;
            default:
                if (_boolValueExp.test(token)) {
                    return _tokenTypes.boolValue;
                }
                else if (_nullValueExp.test(token)) {
                    return _tokenTypes.nullValue;
                }
                else if (_keyExp.test(token)) {
                    return _tokenTypes.key;
                }
                else if (_stringValueExp.test(token)) {
                    return _tokenTypes.stringValue;
                }
                else if (_numberValueExp.test(token)) {
                    return _tokenTypes.numberValue;
                }
                else {
                    throw new Error(`Unexpected token: '${token}'`);
                }
        }
    }

    class Filter {
        /**
         * Check whether or not an object passes the filter.
         * @param {Object} input A filterable object.
         * @returns {boolean} Whether or not the input passes.
         */
        evaluate(input) {
            return true;
        }
    }

    class NegationFilter extends Filter {
        constructor(operand) {
            super();
            this.operand = operand;
        }

        evaluate(input) {
            return !this.operand.evaluate(input);
        }
    }

    class IntersectionFilter extends Filter {
        constructor(lhs, rhs) {
            super();
            this.lhs = lhs;
            this.rhs = rhs;
        }

        evaluate(input) {
            return this.lhs.evaluate(input) && this.rhs.evaluate(input);
        }
    }

    class UnionFilter extends Filter {
        constructor(lhs, rhs) {
            super();
            this.lhs = lhs;
            this.rhs = rhs;
        }

        evaluate(input) {
            return this.lhs.evaluate(input) || this.rhs.evaluate(input);
        }
    }

    class EqualityFilter extends Filter {
        constructor(key, value) {
            super();
            this.key = key;
            this.value = value;
        }

        evaluate(input) {
            return input[this.key] === this.value.evaluate(input);
        }
    }

    class GreaterThanFilter extends Filter {
        constructor(key, value) {
            super();
            this.key = key;
            this.value = value;
        }

        evaluate(input) {
            if (this.key === "prediction" && input[this.key] === null) {
                return false
            }
            return input[this.key] > this.value.evaluate(input);
        }
    }

    class LessThanFilter extends Filter {
        constructor(key, value) {
            super();
            this.key = key;
            this.value = value;
        }

        evaluate(input) {
            if (this.key === "prediction" && input[this.key] === null) {
                return false
            }
            return input[this.key] < this.value.evaluate(input);
        }
    }

    class FilterValue {
        constructor(value) {
            this.value = value;
        }

        evaluate(input) {
            return this.value;
        }
    }

    class FilterKeyValue extends FilterValue {
        constructor(value) {
            super(value);
        }

        evaluate(input) {
            return input[this.value];
        }
    }

    function _getPrimitiveFilterConstructor(token) {
        if (!token) {
            throw new Error("Expected '=', '>' or '<'");
        }
        switch (token.type) {
            case _tokenTypes.eq:
                return EqualityFilter;
            case _tokenTypes.gt:
                return GreaterThanFilter;
            case _tokenTypes.lt:
                return LessThanFilter;
            default:
                throw new Error(`Expected '=', '>' or '<', got '${token.value}'`);
        }
    }

    function _getCombinedFilterConstructor(token) {
        switch (token.type) {
            case _tokenTypes.and:
                return IntersectionFilter;
            case _tokenTypes.or:
                return UnionFilter;
            default:
                throw new Error(`Expected 'AND' or 'OR', got '${token.value}'`);
        }
    }

    function _getPrimitiveValue(token) {
        if (!token) {
            throw new Error("Expected a value or a key");
        }
        switch (token.type) {
            case _tokenTypes.boolValue:
                return new FilterValue(token.value === "true");
            case _tokenTypes.stringValue:
                return new FilterValue(token.value.slice(1, -1));
            case _tokenTypes.numberValue:
                return new FilterValue(Number(token.value));
            case _tokenTypes.key:
                return new FilterKeyValue(token.value);
            case _tokenTypes.nullValue:
                return new FilterValue(null)
            default:
                throw new Error(`Expected a value or a key, got '${token.value}'`);
        }
    }

    function _tokenizeQuery(query) {
        const rawTokens = query.match(_tokenExp);
        if (rawTokens) {
            const tokenInfo = rawTokens.map(rawToken => {
                const value = rawToken.trim();
                const type = _getTokenType(value);
                return {
                    value: value,
                    type: type
                };
            });
            return tokenInfo;
        }
        else {
            return [];
        }
    }

    function _parsePrimitiveSubfilter(key, tokens) {
        const operationToken = tokens.shift();
        const filterConstructor = _getPrimitiveFilterConstructor(operationToken);
        const rhsToken = tokens.shift();
        const rhsValue = _getPrimitiveValue(rhsToken);
        const filter = new filterConstructor(key, rhsValue);
        if (tokens.length === 0 || tokens[0].type === _tokenTypes.rightP) {
            return filter;
        }
        else {
            return _parseCombinedSubfilter(filter, tokens);
        }
    }

    function _parseCombinedSubfilter(filter, tokens) {
        const operationToken = tokens.shift();
        const filterConstructor = _getCombinedFilterConstructor(operationToken);
        const rhs = _parseFilter(tokens);
        return new filterConstructor(filter, rhs);
    }

    function _parseParenthesizedSubfilter(tokens) {
        const filter = _parseFilter(tokens);
        const rightParenthesis = tokens.shift();
        if (!rightParenthesis) {
            throw new Error("Expected ')'");
        }
        else if (rightParenthesis.type === _tokenTypes.rightP) {
            if (tokens.length === 0) {
                return filter;
            }
            else {
                return _parseCombinedSubfilter(filter, tokens);
            }
        }
        else {
            throw new Error(`Expected ')', got '${rightParenthesis.value}'`);
        }
    }

    function _parseFilter(tokens) {
        const token = tokens.shift();
        if (!token) {
            throw new Error("Expected key, '(', or 'NOT'");
        }
        else if (token.type === _tokenTypes.not) {
            const negatedFilter = _parseFilter(tokens);
            return new NegationFilter(negatedFilter);
        }
        else if (token.type === _tokenTypes.leftP) {
            return _parseParenthesizedSubfilter(tokens);
        }
        else if (token.type === _tokenTypes.key) {
            return _parsePrimitiveSubfilter(token.value, tokens);
        }
        else {
            throw new Error(`Expected key, '(', or 'NOT', got '${token.value}'`);
        }
    }

    /**
     * Parse a filter query and return a Filter object that can be used
     * to check whether or not an object that hass been processed
     * with one of the preprocessing functions passes conditions
     * specified in the query. The query is formatted in BNF as follows:
     *
     * <query> ::= <filter>
     * <filter> ::= <negation><filter>|<primitive>|<combination>|<left><filter><right>
     * <negation> ::= "not"|"NOT"
     * <left> ::= "("|"["
     * <right> ::= ")"|"]"
     * <combination> ::= <filter><combop><filter>
     * <primitive> ::= <key><primop><value>
     * <combop> ::= <union>|<intersection>
     * <union> ::= "AND"|"and"
     * <intersection> ::= "OR"|"or"
     * <primop> ::= <equality>|<gt>|<lt>
     * <equality> ::= "IS"|"is"|"="
     * <gt> ::= ">"
     * <lt> ::= "<"
     * <value> ::= <key>|"true"|"false"|<string>|<integer>|<float>|"null"
     *
     * <key> corresponds to any sequence of alphanumeric characters that
     * start with a letter, and <string> corresponds to any sequence
     * of characters surrounded by "" or ''.
     * @param {string} query The filter query to parse.
     * @returns {Filter} The filter object.
     */
    function getFilterFromQuery(query) {
        const tokens = _tokenizeQuery(query);
        if (tokens.length === 0) {
            return new Filter(); // Trivial, all-passing filter
        }
        else {
            const filter = _parseFilter(tokens);
            if (tokens.length === 0) {
                return filter;
            }
            else {
                const unexpectedToken = tokens.shift();
                throw new Error(`Unexpected '${unexpectedToken.value}'`);
            }
        }
    }

    /**
     * Create an object that contains the filterable properties of an
     * annotation.
     * @param {annotationHandler.Annotation} annotation The annotation to be
     * processed.
     * @return {Object} The processed object.
     */
    function preprocessAnnotationBeforeFiltering(annotation) {
        return {
            class: annotation.mclass,
            author: annotation.author,
            comments: annotation.comments ? annotation.comments.length : 0,
            bookmarked: annotation.bookmarked,
            region: annotation.points.length > 1,
            marker: annotation.points.length === 1,
            x: annotation.centroid.x,
            y: annotation.centroid.y,
            z: annotation.z,
            prediction: annotation.prediction,
        };
    }

    /**
     * Create an object that contains the filterable properties of a
     * collaboration.
     * @param {Object} collab The collab to be processed.
     * @return {Object} The processed object.
     */
    function preprocessCollabBeforeFiltering(collab) {
        return {
            name: collab.name,
            author: collab.author,
            created: dateUtils.formatReadableDate(collab.createdOn),
            updated: dateUtils.formatReadableDate(collab.updatedOn),
            annotations: collab.nAnnotations,
            comments: collab.nComments,
            users: collab.nUsers
        };
    }

    return {
        getFilterFromQuery: getFilterFromQuery,
        preprocessAnnotationBeforeFiltering: preprocessAnnotationBeforeFiltering,
        preprocessCollabBeforeFiltering: preprocessCollabBeforeFiltering
    };
})();
