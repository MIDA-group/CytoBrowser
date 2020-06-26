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

    dataToJSON: function(){
        const data = {
            version: "1.0", // Version of the JSON formatting
            points: []
        };

        d3.selectAll(".TMCP-ISS").each(function() {
            let point = d3.select(this);
            data.points.push({
                x: point.attr("gx"),
                y: point.attr("gy"),
                z: point.attr("z"),
                class: point.attr("mclass")
            });
        })

        return data;
    },

    /**
     * @function
     * Save the data from a hiden <a> tag into a json file containing the locations of the points.
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


    /**
     * @function
     * Read text area and create all the
     * symbols dynamically. If the JSON is not well formatted, the points will not be loaded.
     */
    importPointsFromJSON: function(){
        console.log("KALLEy");

        iconId=1;
        d3.select(tmcpoints.ISS_svgov.node()).selectAll("*").remove();
        var tablebody=document.getElementById("tmcptablebody");
        //didnt want to but use jquery for simplicity
        $("#tmcptablebody").children().remove();

        var ta=document.getElementById('jsonpoints');
        ta.className="form-control";
        try{
            var jsonobjects=JSON.parse(ta.value);
        }catch(e){
            alert("The points syntax is wrong, verify your JSON notation. Points were not loaded.");
        }

        console.log("JSON: "+jsonobjects.reference.length);

        for(var i=0; i <jsonobjects.reference.length; i++){
            var ref=jsonobjects.reference[i];
            var normref=tmcpoints.ISS_viewer.viewport.imageToViewportCoordinates(ref[0], ref[1]);

            var options=overlayUtils.drawTMCP("ISS",{"x":normref.x,"y":normref.y});
            overlayUtils.addRowToTable("tmcptablebody",internaloptions.id,ref[0], ref[1]);
        }
    },

    readJSONToData: function(){
        // Clear all current points
        if (!window.File || !window.FileReader || !window.FileList || !window.Blob) {
            throw new Error("The File APIs are not fully supported in this browser.");
        }
        var text = document.getElementById("data_files_import");
        var file = text.files[0];
        if(!file){alert('No file selected'); return; }
        if (file.type.match('json')) {
            markerPoints.clearPoints();
            var reader = new FileReader();
            reader.readAsText(file);
            reader.onload=function(event) {
                const data = JSON.parse(event.target.result);
                // In case the data representation changes but we want compatibility
                switch (data.version) {
                    case "1.0":
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
/*
    importDataFromJSON: function(datainJSONFormat){
        // TODO: This is clunky, should refactor
        jsonData.forEach((point) => );
        let current_class = overlayUtils.markerClass;
        datainJSONFormat.points.forEach(function(point) {
            overlayUtils.setClass(Number(point.class));

            // Convert the image coordinates to viewport coordinates first
            const vx = point.x / overlayUtils.OSDimageWidth("ISS");
	    // TODO: Assumes square image
            const vy = point.y / overlayUtils.OSDimageWidth("ISS");

            overlayUtils.addTMCP(vx, vy, point.z, point.class);
        });
        overlayUtils.setClass(current_class);
    }
    */
}
