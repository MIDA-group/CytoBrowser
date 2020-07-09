JSONUtils={
    //This function calls all the points in the Fabric JS canvases and encodes them into JSON
    //format in a way that is suitable for numpy.linalg.lstsq least squares to find the
    //affine transformation matrix.
    //https://docs.scipy.org/doc/numpy/reference/generated/numpy.linalg.lstsq.html
    /**
     * @function
     * Take the currently drawn SVG points, look at their transform attribute using
     * {@link overlayUtils.transformToObject} and then
     * find the coordinate in the image space in pixels by calling {@link overlayUtils.pointToImage}
     * @returns {Object} An object with two keys to the arrays of the points locations in the
     * two viewers
     */

    // Only needed for live JSON display(?)
    pointsToJSON: function(){
        var me={ };
        me.reference=Array();

        d3.selectAll(".TMCP-ISS").each(function() {
            var d3node=d3.select(this);
            var transformObj=overlayUtils.transformToObject(d3node.attr("transform"));
            var OSDPoint=new OpenSeadragon.Point(Number(transformObj.translate[0]),Number(transformObj.translate[1]));
            var imageCoord=overlayUtils.pointToImage(OSDPoint,"ISS");
            me.reference.push(Array(imageCoord.x, imageCoord.y, 1));
            //console.log(OSDPoint,imageCoord);
        });
        return me;
    },

    /**
     * @function
     * Store all necessary information for the data points present in
     * the current session as a JSON-formatted Object.
     * @returns {Object} An object containing all points' data.
     */
    dataToJSON: function(){
        const data = {
            version: "1.0", // Version of the JSON formatting
            image: tmapp.image_name,
            points: []
        };
        markerPoints.forEachPoint(function(point) {data.points.push(point)});
        return data;
    },

    /**
     * @function
     * Save the data of all points in the session as a JSON file on the
     * local machine.
     */
    downloadJSON: function(){
        var a = document.createElement("a");
        var data = "text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(JSONUtils.dataToJSON(),0,4));
        a.setAttribute("href", "data:"+data);
        a.setAttribute("download", "data.json");
        a.setAttribute('visibility', 'hidden');
        a.setAttribute('display', 'none');
        a.click();
        a.remove();
    },

    /**
     * @function
     * Fill the text area with the points JSON, be it current points in display or the imported points
     * @param {Object} jsonpoints - JSON object to stringify
     */
    setJSONString:function(jsonpoints){
        var ta=document.getElementById('jsonpoints');
        ta.className="form-control";

        if(jsonpoints){
            ta.value=JSON.stringify(jsonpoints);
        }else{
            ta.value=JSON.stringify(JSONUtils.pointsToJSON(),0,4);
        }
    },

    readJSONToData: function(){
        // Clear all current points
        if (!window.File || !window.FileReader || !window.FileList || !window.Blob) {
            throw new Error("The File APIs are not fully supported in this browser.");
        }
        var text = document.getElementById("data_files_import");
        var file = text.files[0];
        if(!file){
            alert("No file selected");
            return;
        }
        if (!file.type.match('json')) {
            alert("File should be json");
            return;
        }
        var reader = new FileReader();
        reader.readAsText(file);
        reader.onload=function(event) {
            const data = JSON.parse(event.target.result);
            // In case the data representation changes but we want compatibility
            switch (data.version) {
                case "1.0":
                    // Change image if data is for another image
                    if (data.image !== tmapp.image_name) {
                        if (!confirm(`You are trying to load data for \
                            the image "${data.image}". Do you want to \
                            open this image? Any markers placed on the \
                            current image will be lost unless you save \
                            them first.`)) {
                            break;
                        }
                        tmapp.changeImage(data.image, function() {
                            markerPoints.clearPoints();
                            data.points.forEach((point) => {
                                markerPoints.addPoint(point, "image");
                            })
                        });
                    }
                    markerPoints.clearPoints();
                    data.points.forEach((point) => {
                        markerPoints.addPoint(point, "image");
                    })
                    break;
                default:
                    throw new Error("Data format version " + points.version + " not implemented.");
            }
        };
    }
}
