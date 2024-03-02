/**
 * Utility functions for useful mathematical computations.
 *
 * @namespace mathUtils
 */
 const mathUtils = (function() {
    "use strict";

    // Functions below are used for checking of a polygon intersects
    // itself. This is done by iterating through each pair of line segments
    // that makes up the polygon and checking if intersecting any other.

    /**
     * Check whether two line segments intersect
     */
    // Modified from https://jsfiddle.net/ferrybig/eokwL9mp/  
    // Via https://stackoverflow.com/questions/563198/how-do-you-detect-where-two-line-segments-intersect/1201356#1201356
    function _segsIntersect(a, b) {
        const h1 = _computeH(a[0],a[1],b[0],b[1]);
        if (h1 < 0 || h1 > 1) return false;
        const h2 = _computeH(b[0],b[1],a[0],a[1]);
        return h2 >= 0 && h2 <= 1;
    }
    // Subroutine of _segsIntersect
    function _computeH(a, b, c, d) {
        // E = B-A = ( Bx-Ax, By-Ay )
        const e = {x: b.x-a.x, y: b.y-a.y }
        // F = D-C = ( Dx-Cx, Dy-Cy ) 
        const f = {x: d.x-c.x, y: d.y-c.y }
        // P = ( -Ey, Ex )
        const p = {x: -e.y, y: e.x}
        
        // h = ( (A-C) * P ) / ( F * P )
        const intersection = f.x*p.x+f.y*p.y;
        if(intersection === 0) {
            // Parallel lines
            return NaN;
        }
        return ( (a.x - c.x) * p.x + (a.y - c.y) * p.y) / intersection;
    }

     /**
      * Check whether or not a 2D path intersects itself.
      * @param {Array<Object>} points An array of points that define
      * the path. Each point is an object that should have x and y
      * coordinates defined.
      * @param {boolean} [closed=true] Whether or not there is an edge
      * between the last and the first point of the path.
      * @returns Whether or not the path intersects itself.
      */
     function pathIntersectsSelf(points, closed=true) {
         const endpoints = closed ? [...points, points[0]] : [...points];
         const segs = endpoints.slice(0, -1).map((p, i) => {
             return [
                 {x: p.x, y: p.y},
                 {x: endpoints[i + 1].x, y: endpoints[i + 1].y}
             ];
         });
         const noIntersections = segs.every((p1, i) => { //Don't check consecutive segment (shared vertex)
            return segs.slice(i + 2, i+segs.length-closed).every(p2 => !_segsIntersect(p1, p2));
         });
         return !noIntersections;
     }

     function getCentroid(points) {
        if (points.length === 1)
            return points[0];
        else {
            // Wikipedia says this won't work with self-intersections
            // https://en.wikipedia.org/wiki/Centroid#Of_a_polygon
            const loop = [...points, points[0]];
            let area = 0;
            let cx = 0;
            let cy = 0;
            loop.reduce((a, b) => {
                const areaTerm = (a.x * b.y) - (b.x * a.y);
                area += areaTerm;
                cx += (a.x + b.x) * areaTerm;
                cy += (a.y + b.y) * areaTerm;
                return b;
            });
            area /= 2;
            cx /= (6 * area);
            cy /= (6 * area);
            return {x: cx, y: cy};
        }
    }

    function _sqrDist(a,b) {
        const x = a.x - b.x;
        const y = a.y - b.y;  
        return x*x + y*y;
    }

    //Approximate!
    function getDiameter(points) {
        if (points.length === 1)
            return 0;
        else {
            let changed;
            let sqrDiam=0;
            let newRef;
            let ref=points[0];
            do {
                changed=false;
                points.forEach(element => {
                    let d=_sqrDist(ref,element);
                    if (d>sqrDiam) {changed=true;sqrDiam=d;newRef=element;}
                });
                ref=newRef;
            } while (changed);
            return Math.sqrt(sqrDiam);
        }
    }

    //Round to N digits of decimals (allows -N as well)
    //Improved version of Solution 1 from https://stackoverflow.com/questions/11832914/how-to-round-to-at-most-2-decimal-places-if-necessary?page=1&tab=trending#answer-12830454
    function roundDecimals(num, scale) {
        const [ base, exp=0 ] = ("" + num).toLowerCase().split("e");
        return +(Math.round(+base + "e" + (+exp + scale)) + "e" + -scale);
    }

    return {
        pathIntersectsSelf,
        getCentroid,
        getDiameter,
        roundDecimals
    };
})();
