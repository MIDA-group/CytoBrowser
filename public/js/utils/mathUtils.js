/**
 * Utility functions for useful mathematical computations.
 *
 * @namespace mathUtils
 */
 const mathUtils = (function() {

     // Functions below are used for checking of a polygon intersects
     // itself. This is done by iterating through each pair of line
     // segments that makes up the polygon, finding the transformation
     // that turns one of these segment into the segment from (0, 0) to (1, 0),
     // applying that transformation to the second segment, and checking
     // if any of its points are found in the normalized segment.

     // Get the parameters needed to transform a given segment to [(0,0),(1,0)]
     function _getTransformParams(seg) {
         const offset = seg[0];
         const p = {
             x: seg[1].x - offset.x,
             y: seg[1].y - offset.y
         };
         const rotation = -Math.atan2(p.y, p.x);
         const scale = 1 / Math.sqrt(p.x**2 + p.y**2);
         return {
             offset,
             rotation,
             scale
         };
     }

     // Apply the transform parameters derived in _getTransformParams()
     // to a given point.
     function _applyTransform(point, params) {
         // Apply translation
         let result = {
             x: point.x - params.offset.x,
             y: point.y - params.offset.y
         };
         // Apply rotation
         const cos = Math.cos(params.rotation);
         const sin = Math.sin(params.rotation);
         result = {
             x: cos * result.x - sin * result.y,
             y: sin * result.x + cos * result.y
         };
         // Apply scale
         result = {
             x: params.scale * result.x,
             y: params.scale * result.y
         };
         // Due to rounding errors, it's possible for the start of the
         // segment that follows the reference segment to be off from
         // (1, 0) by a very small amount. To circumvent this, the
         // value is rounded to some number of decimals that is large
         // enough to not cause inaccuracy, but small enough to avoid
         // the rounding errors. Could cause issues if you ever want
         // to work with images wider than 10 billion pixels.
         result = {
             x: Number(result.x.toFixed(10)),
             y: Number(result.y.toFixed(10))
         }
         return result;
     }

     // Check if two line segments intersect, where the segments are arrays 
     // with two objects that specify the x and y coordinates of the
     // two bounding points of the segment.
     function _segsIntersect(a, b) {
         // Mathematically, segments are counted as open
         const transformParams = _getTransformParams(a);
         const seg = b.map(p => _applyTransform(p, transformParams));
         const noXCrossing = seg[0].y > 0 && seg[1].y > 0 || seg[0].y < 0 && seg[1].y < 0;
         const parallelToX = seg[0].y === seg[1].y;
         const parallelToY = seg[0].x === seg[1].x;
         if (noXCrossing) {
             return false;
         }
         else if (parallelToX) {
             return true;
         }
         else if (parallelToY) {
             return seg[0].x > 0 && seg[0].x < 1;
         }
         else {
             const dxdy =  (seg[1].x - seg[0].x) / (seg[1].y - seg[0].y);
             const xOffset = seg[0].x - (dxdy * seg[0].y);
             return xOffset > 0 && xOffset < 1;
         }
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
         const noIntersections = segs.every((p1, i) => {
             return segs.slice(i + 1).every(p2 => !_segsIntersect(p1, p2));
         });
         return !noIntersections;
     }

     return {
         pathIntersectsSelf
     };
 })();
