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
        var data={ "points":{"ISS":{}} };
        data.points=markerUtils._TMCPS;
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
        overlayUtils.removeAllFromOverlay("ISS");
        var tablebody=document.getElementById("tmcptablebody"); 
        tablebody.innerHTML="";
        overlayUtils.TMCPCount["ISS"]=0;

console.log("ReadJSON");

 //fileElem = document.getElementById("fileElem").click();
        if (window.File && window.FileReader && window.FileList && window.Blob) {
            console.log("KALLE");
            
            var text=document.getElementById("data_files_import");
            text.click();
            var file=text.files[0];
            if(!file){alert('No file selected'); return; }
            if (file.type.match('json')) {	
                console.log("KALLE");
                //console.log(file);
                var reader = new FileReader();
                reader.onload=function(event) {
                    console.log("KALLEx");
                    JSONUtils.importDataFromJSON(JSON.parse(event.target.result));
                    console.log(JSON.parse(event.target.result));
                };
                //var result=
                reader.readAsText(file);
            }
        } else {
            alert('The File APIs are not fully supported in this browser.');
        }
    },

    importDataFromJSON: function(datainJSONFormat){
        console.log("KALLEy");
        for(point in  datainJSONFormat.points.ISS) {
            var pointf=datainJSONFormat.points.ISS[point];
            var returnedmarker=overlayUtils.drawSingleTMCP("ISS",{"saveToTMCPS":true,
                "x":pointf.vx,"y":pointf.vy,"strokeColor":pointf.color});

            var thisid=returnedmarker.id;
            overlayUtils.addRowToTable("tmcptablebody",thisid,pointf.gx,pointf.gy);
        }
    }

}
