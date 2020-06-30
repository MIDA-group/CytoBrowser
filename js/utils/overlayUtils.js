overlayUtils={
    TMCPCount:{"ISS":1},
    markerClass:0,

    _singleTMCPD3Groups: {"ISS":null},

    switchClass: function(){
    	overlayUtils.markerClass=(overlayUtils.markerClass+1) % bethesdaClassUtils.amountClasses;
    },
    setClass: function(cl){
        console.log("Setting:"+cl)
    	overlayUtils.markerClass=(cl) % bethesdaClassUtils.amountClasses;
    },

    drawSingleTMCP: function(overlay,options){
        options.imageWidth=overlayUtils.OSDimageWidth(overlay);
        options.overlay=overlay;
        options.strokeColor=bethesdaClassUtils.classColor(options.mclass);

        var elem=d3.select( tmapp[overlay+"_singleTMCPS"].node());
        return markerUtils.TMCP(elem,options); //Add TMCP
    },

    OSDimageWidth: function(overlay,options){
        if(overlay=="ISS")
            return tmapp.viewer.world.getItemAt(0).getContentSize().x
        else
            console.log("no width image");
    },

    randomColor:function(){
        //I need random colors that are far away from the palette in the image
        //in this case Hematoxilyn and DAB so far away from brown and light blue
        //and avoid light colors because of the white  background
        //in HSL color space this means L from 0.2 to 0.75
        //H [60,190],[220,360], S[0.3, 1.0]
        var rh1=Math.floor(Math.random() * (190 - 60 + 1)) +60;
        var rh2=Math.floor(Math.random() * (360 - 220 + 1)) +220;
        var H=0.0;

        if(Math.random() > 0.5){ H=rh1; }else{ H=rh2; }

        var L=Math.floor(Math.random() * (75-20+1)) + 20 + '%';
        var S=Math.floor(Math.random() * (100-30+1)) + 30 + '%';

        return 'hsl('+H.toString()+','+S.toString()+','+L.toString()+')';
    },

    classColor:function(cl){
        const color = bethesdaClassUtils.classColor(cl);
        if (color === undefined) {
            return overlayUtils.randomColor();
        }
        else {
            return color;
        }
    },

    //https://stackoverflow.com/questions/17824145/parse-svg-transform-attribute-with-javascript
    transformToObject: function(transform){
        var b={};
        for (var i in a = transform.match(/(\w+\((\-?\d+\.?\d*e?\-?\d*,?)+\))+/g))
        {
            var c = a[i].match(/[\w\.\-]+/g);
            b[c.shift()] = c;
        }
        return b;
    },

    objectToTransform: function(tobj){
        var jsonstr=JSON.stringify(tobj);
        //console.log("jsonstr",jsonstr);
        jsonstr=jsonstr.replace("{","");
        jsonstr=jsonstr.replace("}","");
        jsonstr=jsonstr.replace(/("|:)/g, "");
        jsonstr=jsonstr.replace("[","(");
        jsonstr=jsonstr.replace("]",")");
        //console.log("after jsonstr",jsonstr);
        return jsonstr;
    },

    addTrackingToDOMElement: function(node,overlay) {
        new OpenSeadragon.MouseTracker({
            element: node,

            dragHandler: function(event) { //called repeatedly during drag
                const delta = overlayUtils.viewportDelta(event.delta, "ISS");
                const d3node = d3.select(node);
                const htmlid = d3node.attr("id");
                const id = Number(htmlid.split("-")[2]);
                const point = markerPoints.getPointById(id);
                const imageCoords = new OpenSeadragon.Point(point.x, point.y);
                const viewportCoords = overlayUtils.imageToViewport(imageCoords, "ISS");
                const newX = viewportCoords.x + delta.x;
                const newY = viewportCoords.y + delta.y;
                point.x = newX;
                point.y = newY;
                markerPoints.updatePoint(id, point, "viewport");
            },

            clickHandler: function(event){ //also called at end of drag
                const d3node = d3.select(node);

                if (event.originalEvent.ctrlKey) {
                    const htmlid = d3node.attr("id");
                    const id = Number(htmlid.split("-")[2]);
                    markerPoints.removePoint(id);
                }
            }
        }).setTracking(true);
    },

    delRowFromTable: function(tableid,id) {
        var rowid="row-ISS-"+id;
        console.log("rowid:"+rowid);
        var row=document.getElementById(rowid);
        row.parentNode.removeChild(row);
    },

    addRowToTable: function(tableid,id,x1,y1,mclass,z) {
        var tablebody=document.getElementById(tableid);
        var row=tablebody.insertRow(0);
        row.id="row-ISS-"+id;

        var cell1=row.insertCell(0);
        var cell2=row.insertCell(1);
        var cell3=row.insertCell(2);

        cell1.textContent=id;
        cell2.id="cell-ISS-"+id;
        cell2.textContent= "(x: "+Math.round(x1)+", y: "+ Math.round(y1)+", z: "+ z +"; Class: "+mclass+")";

        // Create a button for moving to the point
        const button = document.createElement("button");
        button.textContent = "Move to marker";
        button.className = "btn btn-info btn-link";
        button.type = "button";
        button.addEventListener("click", function(e) { console.log("Moving to " + id); tmapp.panToPoint(id); });
        cell3.appendChild(button);
    },

    updateTableRow: function(tableid,id,x1,y1,mclass,z) {
        var cellid="cell-ISS-"+id;
        var cell=document.getElementById(cellid);
        cell.textContent= "(x: "+Math.round(x1)+", y: "+ Math.round(y1)+", z: "+ z +"; Class: "+mclass+")"; //FIX, don't use different view method for drag
    },

    pointToImage: function(point,overlay){
        if (overlay+"_viewer" in tmapp){
        //    return tmapp[overlay+"_viewer"].viewport.viewportToImageCoordinates( point ); //This gives warning with MultiImages
            return tmapp[overlay+"_viewer"].world.getItemAt(0).viewportToImageCoordinates( point );
        }
    },

    pointFromOSDPixel: function(position,overlay){
        if (overlay+"_viewer" in tmapp){
            return tmapp[overlay+"_viewer"].viewport.pointFromPixel( position );
        }
    },

    imageToViewport: function(imcoords,overlay){
        if (overlay+"_viewer" in tmapp){
            return tmapp[overlay+"_viewer"].viewport.imageToViewportCoordinates( imcoords );
        }
    },

    viewportDelta: function(eventdelta,overlay){
        if (overlay+"_viewer" in tmapp){
            return tmapp[overlay+"_viewer"].viewport.deltaPointsFromPixels(eventdelta);
        }
    },

    addTMCP: function(id, x, y, z, mclass) {
        var optionsF=overlayUtils.drawSingleTMCP("ISS", {
            saveToTMCPS: true,
            id: id,
            x: x,
            y: y,
            z: z,
            mclass: mclass
        });
        //get the pixel coordinates in ISS image
        var imagePointF = overlayUtils.pointToImage(new OpenSeadragon.Point(x, y),"ISS");
        overlayUtils.addRowToTable("tmcptablebody", id, imagePointF.x, imagePointF.y, mclass, z);
    },

    updateTMCP: function(id, x, y, z, mclass) {
        const d3node = d3.select("#TMCP-ISS-" + String(id));
        const transformobj = overlayUtils.transformToObject(d3node.attr("transform"));
        const imagePos = overlayUtils.pointToImage(new OpenSeadragon.Point(x, y),"ISS");

        transformobj.translate[0] = x;
        transformobj.translate[1] = y;
        d3node.attr("transform", overlayUtils.objectToTransform(transformobj));

        overlayUtils.updateTableRow("tmcptablebody", id, imagePos.x, imagePos.y, mclass, z);
    },

    removeTMCP: function(id) {
        // TODO: This is a bit shoddy, should probably clean it up
        const d3node = d3.select("#TMCP-ISS-" + String(id));
        const htmlid = "TMCP-ISS-" + String(id);
        const overlay = "ISS";
        console.log("Deleting ID:"+id+"("+overlayUtils.TMCPCount[overlay]+")");
        delete markerUtils._TMCPS["ISS"][htmlid];
        overlayUtils.delRowFromTable("tmcptablebody",id);
        d3node.remove();
    },

    removeAllFromOverlay: function(overlay){
        d3.select(tmapp[overlay+"_svgov"].node()).selectAll("*").remove();
        tmapp[overlay+"_singleTMCPS"] = d3.select(tmapp[overlay+"_svgov"].node()).append('g').attr('class', overlay+" singleTMCPS");
    }

}
