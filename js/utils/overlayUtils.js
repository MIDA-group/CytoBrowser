overlayUtils={
    TMCPCount:{"ISS":1},
    markerClass:0,
    amountClasses:7,

    _singleTMCPD3Groups: {"ISS":null},

    switchClass: function(){
    	overlayUtils.markerClass=(overlayUtils.markerClass+1) % overlayUtils.amountClasses;
    },
    setClass: function(cl){
        console.log("Setting:"+cl)
    	overlayUtils.markerClass=(cl) % overlayUtils.amountClasses;
    },

    drawSingleTMCP: function(overlay,options){
        options.imageWidth=overlayUtils.OSDimageWidth(overlay);
        options.overlay=overlay;
        options.strokeColor=overlayUtils.classColor(overlayUtils.markerClass);

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
        switch(cl){
            case 0:
                return '#3F3';
            case 1:
                return '#CA3';
            case 2:
                return '#F33';
            case 3:
                return '#3CC';
            case 4:
                return '#F4F';
            case 5:
                return '#CF6';
            case 6:
                return '#FC6';
        }
        return overlayUtils.randomColor();
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
                var viewportDelta=overlayUtils.viewportDelta(event.delta,overlay);
                var d3node=d3.select(node);
                var transformobj=overlayUtils.transformToObject(d3node.attr("transform"));

                transformobj.translate[0]=Number(transformobj.translate[0])+Number(viewportDelta.x);
                transformobj.translate[1]=Number(transformobj.translate[1])+Number(viewportDelta.y);
                //console.log(transformobj);
                d3node.attr("transform",overlayUtils.objectToTransform(transformobj));


                var id=d3node.attr("id").split("-")[2];
                var cellid="cell-"+overlay+"-"+id;
                var cell=document.getElementById(cellid);
                var OSDPoint=new OpenSeadragon.Point(transformobj.translate[0],transformobj.translate[1]);
                var pToImageCoords=overlayUtils.pointToImage(OSDPoint,overlay);
                cell.textContent= "("+Math.round(pToImageCoords.x)+", "+ Math.round(pToImageCoords.y)+")"; //FIX, don't use different view method for drag

                //JSONUtils.setJSONString();
            },

            dragEndHandler: function(event){ //called at end of drag
                var d3node=d3.select(node);
                var htmlid=d3node.attr("id");
                console.log(htmlid);
                var transformobj=overlayUtils.transformToObject(d3node.attr("transform"));
            //    markerUtils._TMCPS[overlay][htmlid]={"x":Number(transformobj.translate[0]),"y":Number(transformobj.translate[1])}; //FIX! Update instead of overwrite!
                markerUtils._TMCPS[overlay][htmlid].x=Number(transformobj.translate[0]);
                markerUtils._TMCPS[overlay][htmlid].y=Number(transformobj.translate[1]);
            },

            clickHandler: function(event){ //also called at end of drag
                console.log("DOM click")
                var d3node=d3.select(node);

                if (cntrlIsPressed) {
                    var htmlid=d3node.attr("id");
                    var id=Number(htmlid.split("-")[2]);

                    console.log("Deleting ID:"+id+"("+overlayUtils.TMCPCount[overlay]+")");
                    delete markerUtils._TMCPS[overlay][htmlid];

                    overlayUtils.delRowFromTable("tmcptablebody",id);
                    d3node.remove();

                    if (id+1==overlayUtils.TMCPCount[overlay]) { //If last one, then decrease count
                        console.log("DeleteLast")
                        overlayUtils.TMCPCount[overlay]--;
                    }
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

    addRowToTable: function(tableid,id,x1,y1,mclass) {
        var tablebody=document.getElementById(tableid);
        var row=tablebody.insertRow(0);
        row.id="row-ISS-"+id;

        var cell1=row.insertCell(0);
        var cell2=row.insertCell(1);

        cell1.textContent=id;
        cell2.id="cell-ISS-"+id;
        cell2.textContent= "("+Math.round(x1)+", "+ Math.round(y1)+"; "+mclass+")";
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

    addTMCPtoViewers: function(event){
        // The canvas-click event gives us a position in web coordinates.
        //The event position is relative to OSD viewer
        // Convert that to viewport coordinates, the lingua franca of OpenSeadragon coordinates.
        var normalizedPointF=overlayUtils.pointFromOSDPixel( event.position, "ISS" );

        //draw in the ISS viewer, now we need to convert it to pixels and then to the moving space viewport to put there
        //also saveToTMCPS array
        console.log("normalizedPointF.x");
        console.log(normalizedPointF.x);
        var optionsF=overlayUtils.drawSingleTMCP("ISS",{"saveToTMCPS":true,"x":normalizedPointF.x,"y":normalizedPointF.y});
        //get the pixel coordinates in ISS image
        var imagePointF = overlayUtils.pointToImage(normalizedPointF,"ISS");
        overlayUtils.addRowToTable("tmcptablebody",optionsF.id,imagePointF.x,imagePointF.y,optionsF.mclass);
        JSONUtils.setJSONString();
    },

    removeAllFromOverlay: function(overlay){
        d3.select(tmapp[overlay+"_svgov"].node()).selectAll("*").remove();
        tmapp[overlay+"_singleTMCPS"] = d3.select(tmapp[overlay+"_svgov"].node()).append('g').attr('class', overlay+" singleTMCPS");
    }

}
