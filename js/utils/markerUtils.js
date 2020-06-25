markerUtils={
	_TMCPStyle:{ strokeWidth: 20, radius: 9, drawText:true, textSize:1 },

	//single TMCP lists
	_TMCPS:{"ISS":{}},

	TMCP: function(element,options){
		var overlay = options.overlay || "ISS";
		var drawText = options.drawText || markerUtils._TMCPStyle.drawText;
		var imageWidth=options.imageWidth || overlayUtils.OSDimageWidth(overlay);
		var tmcpid=overlayUtils.TMCPCount[overlay]++;

		var strokeWidth=options.strokeWidth || markerUtils._TMCPStyle.strokeWidth; strokeWidth/=imageWidth;///10;
		var radius=options.radius || markerUtils._TMCPStyle.radius; radius/=imageWidth;

		console.log("rad"+radius);

		var strokeColor=options.strokeColor || overlayUtils.randomColor();
		var extraClass=options.extraClass || null;
		var x = options.x || null;
		var y = options.y || null;
		var z =options.z || null;
		var gx =options.gx || x*imageWidth;
		var gy =options.gy || y*imageWidth;
		var mclass =options.mclass || overlayUtils.markerClass || 0;
		var elemEnter = element
                        .append("g")
			.attr("id","TMCP-"+overlay+"-"+tmcpid)
			.attr( 'transform','translate('+ x +','+ y +')')
			.attr( 'vx',x)
			.attr( 'vy',y)
			.attr( 'gx',gx)
			.attr( 'gy',gy)
			.attr( 'z',z)
			.attr( 'mclass', mclass);
		if(extraClass){
			elemEnter.attr("class","TMCP-"+overlay+" "+extraClass)
		}else{
			elemEnter.attr("class","TMCP-"+overlay)
		}

		// var square=
		elemEnter
        .append("path")
        	.attr( "d", d3.symbol().size(radius*radius).type(d3.symbolSquare))
        	.attr("transform", "rotate(45)")
			.attr('stroke-width',strokeWidth)
			.attr('stroke', strokeColor).style("fill","rgba(0,0,0,0.2)" );
        	//.attr('stroke', strokeColor).style("fill","transparent" )
		//var circle=
		elemEnter
        .append("path")
	        .attr( "d", d3.symbol().size(radius*radius/4).type(d3.symbolCircle))
	        .attr('stroke-width',strokeWidth/2)
	        .attr('stroke', "gray").style("fill","transparent" );
        if(drawText){
			// var text =
			elemEnter
			.append("text").style("fill", "blue").style("stroke", "white").style("stroke-width", 0.004)
			.style("font-size", "1%").attr("text-anchor", "middle")
            .attr( 'transform','translate(0,0.010) scale('+(markerUtils._TMCPStyle.textSize/20).toString()+ ')')
            .text(tmcpid);/* function(){
            	var toreturn=String(tmcpid);
            	//overlayUtils.TMCPCount[overlay]+=1;
            	return toreturn
            }); */
		}

		if(options.saveToTMCPS){ //Separate storage array
			markerUtils._TMCPS[overlay]["TMCP-"+overlay+"-"+tmcpid]={"vx":x,"vy":y,
			"gx":gx,"gy":gy,"id":tmcpid,"color":strokeColor,"mclass":mclass};
		}

		//Add tracking to all components of the TMCP
        d3.select("#TMCP-"+overlay+"-"+(tmcpid)).each(function() {
			overlayUtils.addTrackingToDOMElement(this,overlay);
        });

        return {"strokeColor":strokeColor,"radius":radius,"strokeWidth":strokeWidth,"id":tmcpid,"mclass":mclass };
	}

}
