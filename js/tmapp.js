/**
 * @file tmapp.js Main base for TissUUmaps to work
 * @author Leslie Solorzano
 * @see {@link tmapp}
 */

/**
 * @namespace tmapp
 * @version tmapp 2.0
 * @classdesc The root namespace for tmapp.
 */
tmapp = {
    _url_suffix: "",
    _scrollDelay: 900,
    _image_dir: "data/", //subdirectory where dzi images are stored
    fixed_file: "",
    viewer: null,

    getFocusLevel: function() {
        return curr_z;
    },
    setFocusLevel: function( z ) {
        var count = this.viewer.world.getItemCount();
        z=Math.min(Math.max(z,0),count-1);
        for (i = 0; i < count; i++) {
            tmapp.viewer.world.getItemAt(i).setOpacity(z==i);
        }
        curr_z=z;
        tmapp.setFocusName();
    },

    setFocusName: function() { //Display focus level in UI
        setImageZLevel(z_levels[tmapp.getFocusLevel()]);
    },
    setZoomName: function() { //Display zoom level in UI
        setImageZoom(Math.round(tmapp.viewer.viewport.getZoom()*10)/10);
    }
}


/** 
 * Get all the buttons from the interface and assign all the functions associated to them */
tmapp.registerActions = function () {
    tmapp["object_prefix"] = tmapp.options_osd.id.split("_")[0];
    var op = tmapp["object_prefix"];
    var cpop="CP";

    interfaceUtils.listen(op + '_bringmarkers_btn','click', function () { dataUtils.processISSRawData(); },false);
    interfaceUtils.listen(op + '_searchmarkers_btn','click', function () { markerUtils.hideRowsThatDontContain(); },false);
    interfaceUtils.listen(op + '_cancelsearch_btn','click', function () { markerUtils.showAllRows(); },false);
    interfaceUtils.listen(op + '_drawall_btn','click', function () { markerUtils.drawAllToggle(); },false);
    interfaceUtils.listen(op + '_drawregions_btn','click', function () { regionUtils.regionsOnOff() },false);
    interfaceUtils.listen(op + '_export_regions','click', function () { regionUtils.exportRegionsToJSON() },false);
    interfaceUtils.listen(op + '_import_regions','click', function () { regionUtils.importRegionsFromJSON() },false);
    interfaceUtils.listen(op + '_export_regions_csv','click', function () { regionUtils.pointsInRegionsToCSV() },false);
    interfaceUtils.listen(op + '_fillregions_btn','click', function () { regionUtils.fillAllRegions(); },false);
    interfaceUtils.listen(cpop + '_bringmarkers_btn','click', function () { CPDataUtils.processISSRawData() },false);

    var uls=document.getElementsByTagName("ul");
    for(var i=0;i<uls.length;i++){
        var as=uls[i].getElementsByTagName("a");
        for(var j=0;j<as.length;j++){
            as[j].addEventListener("click",function(){interfaceUtils.hideTabsExcept($(this))});
        }
    }
//    interfaceUtils.activateMainChildTabs("markers-gui");
}

/**
 * Expand single image name into z-stack array of names */
tmapp.expandImageName = function(img) {
    function* range(start, end, step=1) {
        for (let i = start; i < end; i+=step) {
            yield i;
        }
    }

    setImageName(img);

    //Hard coded z-ranges based on image number
    //TODO: glob for z-range
    if (parseInt(img.match(/^\d*/),10)<=80) {
        z_levels=[...range(-2000, 2001, 400)];
    } 
    else {
        z_levels=[...range(-2500, 2501, 500)];
    }
    console.log(z_levels);

    this.fixed_file=z_levels.map(function(z) {return tmapp._image_dir+img+"_z"+z+".dzi";});
}

/**
 * Open stack of .dzi and set current z-level (default=mid level) */
tmapp.loadImages = function(z=-1) {
    if (z<0) {
        z=Math.floor(this.fixed_file.length/2);
    }
    curr_z=z;
    console.log("Opening: "+this.fixed_file);
    for(i=0;i < this.fixed_file.length;){
        this.viewer.addTiledImage({
            tileSource: this.fixed_file[i],
            opacity: i==curr_z,
            index: i++,
            //Announce when we're done
            success:function() {if (tmapp.viewer.world.getItemCount()==tmapp.fixed_file.length) tmapp.viewer.raiseEvent('open') }
        });
    }
}


/**
 * This method is called when the document is loaded. The tmapp object is built as an "app" and init is its main function.
 * Creates the OpenSeadragon (OSD) viewer and adds the handlers for interaction.
 * To know which data one is referring to, there are Object Prefixes (op). For In situ sequencing projects it can be "ISS" for
 * Cell Profiler data it can be "CP".
 * If there are images to be displayed on top of the main image, they are stored in the layers object and, if there are layers
 * it will create the buttons to display them in the settings panel.
 * The SVG overlays for the viewer are also initialized here 
 * @summary After setting up the tmapp object, initialize it*/
tmapp.init = function () {
    //This prefix will be called by all other utilities in js/utils
    tmapp["object_prefix"] = tmapp.options_osd.id.split("_")[0];
    var op = tmapp["object_prefix"];
    var vname = op + "_viewer";

    this.expandImageName(this.fixed_file);

    //init OSD this.viewer
    this.viewer = OpenSeadragon(tmapp.options_osd);
    tmapp[vname] = this.viewer;

    //Change-of-Page (z-level) handle
    this.viewer.addHandler("page", function (data) {
        tmapp.setFocusName();
    });

    this.viewer.addHandler("zoom", function (data) {
        tmapp.setZoomName();
    });

    //When we're done loading
    this.viewer.addHandler('open', function ( event ) {
        console.log("Done loading!");
        tmapp.viewer.canvas.focus();
        tmapp.viewer.viewport.goHome();
        tmapp.setZoomName();
        tmapp.setFocusName();
    });
    
    //open the DZI xml file pointing to the tiles
//    tmapp[vname].open(this._url_suffix + this.fixed_file);
    this.loadImages();

    //pixelate because we need the exact values of pixels
    this.viewer.addHandler("tile-drawn", OSDViewerUtils.pixelateAtMaximumZoomHandler);

    if(tmapp.layers){
	    var settingspannel=document.getElementById("image-overlay-panel");
    	tmapp.layers.forEach(function(layer,i){
	    var _button = document.createElement("button");
	    _button.setAttribute("id","layer"+(i+1)+"_btn");
	    _button.setAttribute("layer",(i+1));
	    _button.innerHTML=layer.name
             settingspannel.appendChild(_button);
	    tmapp[vname].addTiledImage({
		    index: i+1,tileSource: tmapp._url_suffix+layer.tileSource, opacity:0.0
	     });
	    _button.addEventListener("click",function(ev){
		 var layer=ev.srcElement.attributes.layer;
	        overlayUtils.setItemOpacity(i+1); 
	    });
	});
    }


    //Create svgOverlay(); so that anything like D3, or any canvas library can act upon. https://d3js.org/
    var svgovname = tmapp["object_prefix"] + "_svgov";
    tmapp[svgovname] = this.viewer.svgOverlay();

    //main node
    overlayUtils._d3nodes[op + "_svgnode"] = d3.select(tmapp[svgovname].node());
    
    //overlay for marker data                                             //main node
    overlayUtils._d3nodes[op + "_markers_svgnode"] = overlayUtils._d3nodes[op + "_svgnode"].append("g")
        .attr("id", op + "_markers_svgnode");
    //overlay for region data                                              //main node
    overlayUtils._d3nodes[op + "_regions_svgnode"] = overlayUtils._d3nodes[op + "_svgnode"].append("g")
        .attr("id", op + "_regions_svgnode");
    //overlay for CP data   
    var cpop="CP";                                   //main node;
    overlayUtils._d3nodes[cpop+"_svgnode"] = overlayUtils._d3nodes[op + "_svgnode"].append("g")
        .attr("id", cpop+"_svgnode");

    var click_handler = function (event) {
        if (event.quick) {
            if (overlayUtils._drawRegions) {
                //call region creator and drawer
                regionUtils.manager(event);
            }
        } else { //if it is not quick then its panning
            scroll_handler();
        }
    };


    //delay the scroll and the panning options so that there is a bit more time to calcualte which 
    //markers to plot and where and how many
    var isScrolling;
    var scroll_handler = function (event) {

        // Clear our timeout throughout the scroll
        window.clearTimeout(isScrolling);
        // Set a timeout to run after scrolling ends
        isScrolling = setTimeout(function () {

            // Run the callback
            console.log('Scrolling has stopped.');
            //
            overlayUtils.modifyDisplayIfAny();

        }, tmapp._scrollDelay);

    }


    //OSD handlers are not registered manually they have to be registered
    //using MouseTracker OSD objects 
    var ISS_mouse_tracker = new OpenSeadragon.MouseTracker({
        //element: this.fixed_svgov.node().parentNode, 
        element: this.viewer.canvas,
        clickHandler: click_handler,
        scrollHandler: scroll_handler
    }).setTracking(true);

    //document.getElementById('cancelsearch-moving-button').addEventListener('click', function(){ markerUtils.showAllRows("moving");}); 
} //finish init


/**
 * Options for the fixed and moving OSD 
 * all options are described here https://openseadragon.github.io/docs/OpenSeadragon.html#.Options */
tmapp.options_osd = {
    id: "ISS_viewer", //cybr_viewer
    prefixUrl: "js/openseadragon/images/", //Location of button graphics
    navigatorSizeRatio: 1,
    wrapHorizontal: false,
    showNavigator: false,
    navigatorPosition: "BOTTOM_LEFT",
    navigatorSizeRatio: 0.25,
    animationTime: 0.0,
    blendTime: 0,
    minZoomImageRatio: 1,
    maxZoomPixelRatio: 4,
    gestureSettingsMouse: {clickToZoom: false},
    zoomPerClick: 1.4,
    constrainDuringPan: true,
    visibilityRatio: 1,
    showNavigationControl: true, //FIX: After Full screen, interface stops working

    //imageSmoothingEnabled: false,
    sequenceMode: false, // true,
    preserveViewport: true,
    preserveOverlays: true,
    preload: true
}
