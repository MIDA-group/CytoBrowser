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
    initial_params: null,
    curr_zoom: 0.7,
    curr_x: 0,
    curr_y: 0,
    curr_z: 5,
    lost_focus: false,

    getFocusLevel: function() {
        return this.curr_z;
    },
    setFocusLevel: function( z ) {
        var count = this.viewer.world.getItemCount();
        z=Math.min(Math.max(z,0),count-1);
        for (i = 0; i < count; i++) {
            tmapp.viewer.world.getItemAt(i).setOpacity(z==i);
        }
        this.curr_z=z;
        tmapp.setFocusName();
    },
    checkFocus: function() {
        tmapp.lost_focus=!document.hasFocus(); //If the document lost focus, there is no way to get it back
    },

    setFocusName: function() { //Display focus level in UI
        setImageZLevel(z_levels[tmapp.getFocusLevel()]);
        this.updateURLParams();
    },
    setZoomName: function() { //Display zoom level in UI
        const zoom = this.viewer.viewport.getZoom();
        setImageZoom(Math.round(zoom*10)/10);
        this.curr_zoom = zoom;
        this.updateURLParams();
    },
    setPosition: function() { //Update the current position params
        const position = this.viewer.viewport.getCenter();
        this.curr_x = position.x;
        this.curr_y = position.y;
        this.updateURLParams();
    },
    updateURLParams: function() { //Update the URL params
        url = new URL(window.location.href);
        let roundTo = (x, n) => Math.round(x * Math.pow(10, n)) / Math.pow(10, n);
        params = url.searchParams;
        params.set("zoom", roundTo(this.curr_zoom, 2));
        params.set("x", roundTo(this.curr_x, 5));
        params.set("y", roundTo(this.curr_y, 5));
        params.set("z", this.curr_z - 5);
        setURL("?" + params.toString());
    }
}


/**
 * Get all the buttons from the interface and assign all the functions associated to them */
/* tmapp.registerActions = function () {
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
 */

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
            success:function() { if (tmapp.viewer.world.getItemCount()==tmapp.fixed_file.length) { tmapp.viewer.raiseEvent('open') } },
            error:function() { tmapp.viewer.raiseEvent('open-failed') }
        });
    }
}


/**
 * OSD view callbacks */
tmapp.add_handlers = function () {
    viewer=tmapp.viewer;

    //Change-of-Page (z-level) handle
    viewer.addHandler("page", function (data) {
        tmapp.setFocusName();
    });

    viewer.addHandler("zoom", function (data) {
        tmapp.setZoomName();
    });

    viewer.addHandler("pan", function (data) {
        tmapp.setPosition();
    });

    //When we're done loading
    viewer.addHandler("open", function ( event ) {
        console.log("Done loading!");
        tmapp.viewer.canvas.focus();

        const params = tmapp.initial_params;
        if (params !== null) {
            // Move the viewport to the initial params if defined
            const zoom = params.zoom;
            const center = new OpenSeadragon.Point(params.x, params.y);
            viewer.viewport.zoomTo(zoom, null, true);
            viewer.viewport.panTo(center, true);
            tmapp.setFocusLevel(params.z + 5);
	    // Currently hard-coded to 5, may want to do this better
        }
        else {
            // Otherwise move to home
            viewer.viewport.goHome();
        }

        tmapp.setZoomName();
        tmapp.setFocusName();
    });

    //Error message if we fail to load
    viewer.addHandler('open-failed', function ( event ) {
        //alert( "ERROR!\nOpenFailed: "+ event.message + "\n" );
        console.log("Open failed!");
    });

    //pixelate at MaxZoom level (instead of blur)
//    viewer.addHandler("tile-drawn", OSDViewerUtils.pixelateAtMaximumZoomHandler);
}


/**
 * This method is called when the document is loaded.
 * Creates the OpenSeadragon (OSD) viewer and adds the handlers for interaction.
 * The SVG overlays for the viewer are also initialized here */
tmapp.init = function () {
    //This prefix will be called by all other utilities in js/utils
    tmapp["object_prefix"] = tmapp.options_osd.id.split("_")[0];
    var op = tmapp["object_prefix"];
    var vname = op + "_viewer";


    this.expandImageName(this.fixed_file);

    //init OSD viewer
    this.viewer = OpenSeadragon(tmapp.options_osd);
    tmapp[vname] = this.viewer; //For js/utils, this is a TissUUmaps thing. TODO: Get rid of TissUUmaps things we do not use.

    this.add_handlers();

    //open the DZI xml file pointing to the tiles
    this.loadImages();


    //Create svgOverlay(); so that anything like D3, or any canvas library can act upon. https://d3js.org/
    tmapp.svgov=tmapp.viewer.svgOverlay();
    tmapp.ISS_singleTMCPS=d3.select(tmapp.svgov.node()).append('g').attr('class', "ISS singleTMCPS");


    //This is the OSD click handler, when the event is quick it triggers the creation of a marker
    //Called when we are far from any existing points; if we are close to elem, then DOM code in overlayUtils is called instead
    var click_handler= function(event) {
        if(event.quick){
            console.log("New click!");
            // if (!(document.hasFocus())) {
            if (tmapp.lost_focus) { //We get document focus back before getting the event
                console.log("Lost document focus, ignoreing click and just setting (element) focus"); //Since it's irritating to get TMCP by asking for focus
                tmapp.fixed_viewer.canvas.focus();
                tmapp.checkFocus();
            }
            else if (cntrlIsPressed) {
            }
            else {
                console.log("Adding point");
                overlayUtils.addTMCPtoViewers(event);
            }
        }
        else {
            //if it is not quick then it is dragged
            console.log("drag thing");
        }
    };

    var scroll_handler = function(event){
        if (cntrlIsPressed) {
            //TODO: Ctrl-scroll = focus
        }
        console.log("scroll thing");
    };

    //OSD handlers have to be registered using MouseTracker OSD objects
    var ISS_mouse_tracker = new OpenSeadragon.MouseTracker({
        element: this.viewer.canvas,
        clickHandler: click_handler,
        scrollHandler: scroll_handler
    }).setTracking(true);



    //Assign the function to the button in the document (this should be done more dynamically)
    document.getElementById('pointstojson').addEventListener('click', JSONUtils.downloadJSON);
    document.getElementById('jsontodata').addEventListener('click', JSONUtils.readJSONToData);

    classes.forEach(function(item, index){
        $("#class_" + item.name).click(function(){ overlayUtils.setClass(index) });
    });

    document.getElementById("focus_next").addEventListener('click', function(){ tmapp.setFocusLevel(tmapp.getFocusLevel()+1); } );
    document.getElementById("focus_prev").addEventListener('click', function(){ tmapp.setFocusLevel(tmapp.getFocusLevel()-1); } );

    tmapp.viewer.canvas.addEventListener('mouseover', function() { tmapp.checkFocus(); });

    console.log("Finish init");
} //finish init


/**
 * Options for the fixed and moving OSD
 * all options are described here https://openseadragon.github.io/docs/OpenSeadragon.html#.Options */
tmapp.options_osd = {
    id: "ISS_viewer", //cybr_viewer
    prefixUrl: "js/openseadragon/images/", //Location of button graphics
    navigatorSizeRatio: 1,
    wrapHorizontal: false,
    showNavigator: true,
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
