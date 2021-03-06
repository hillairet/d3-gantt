(function () {
	d3.gantt = function() {
		////////////// Setting variables ///////////////
		var DISPLAY_TYPES = ["circle", "rect"];

		var hover = function () {},
		mouseover = function () {},
		mouseout = function () {},
		click = function () {},
		scroll = function () {},
		labelFunction = function(label) { return label; },
		navigateLeft = function () {},
		navigateRight = function () {},
		orient = "bottom",
		width = null,
		height = null,
		rowSeparatorsColor = null,
		backgroundColor = null,
		tickFormat = { format: d3.time.format("%I %p"),
			tickTime: d3.time.hours,
			tickInterval: 1,
			tickSize: 6,
			tickValues: null
		},
		colorCycle = d3.scale.category20(),
		colorPropertyName = null,
		display = "rect",
		beginning = 0,
		labelMargin = 0,
		ending = 0,
		margin = {left: 20, right:20, top: 20, bottom:20},
		stacked = false,
		rotateTicks = false,
		ylabelsleftaligned = false,
		itemHeight = 60,
		itemMargin = 5,
		navMargin = 60,
		showTimeAxis = true,
		showAxisTop = false,
		showTodayLine = false,
		timeAxisTick = false,
		timeAxisTickFormat = {stroke: "stroke-dasharray", spacing: "4 10"},
		showTodayFormat = {marginTop: 25, marginBottom: 0, width: 2, color: "#FF0000"},
		showBorderFormat = {marginTop: 25, marginBottom: 0, width: 1, color: colorCycle},
		showAxisCalendarYear = false,
		axisBgColor = "white",
		chartData = {},
		axisDelay = 500,
		legendRectSize = 18,
		legendSpacing = 4
		;

		////////////// Selection variables ///////////////
		var gParent,
		svg,
		xAxis,
		gxAxis,
		yAxis,
		gyAxis,
		chart,
		chartdeco,
		clipalongy,
		clipchart,
		todayLine,
		legend,
		legend_items,
		current_data;

		function find_xrange(data){
			// figure out beginning and ending times if they are unspecified
			if ( ending === 0 || beginning === 0) {
				var minTime = 0,
				maxTime = 0;
				data.forEach(function (entry, i) {
					entry.times.forEach(function (time, j) {
						if (minTime === 0){
							minTime = time.starting_time;
							maxTime = time.starting_time;
						}
						if(beginning === 0)
							if (time.starting_time < minTime )
								minTime = time.starting_time;
						if(ending === 0)
							if (time.ending_time > maxTime)
								maxTime = time.ending_time;
					});
				});
				if ( beginning === 0)
					beginning = minTime;
				if ( ending === 0)
					ending = maxTime;
			}
		}

		///////////////////////////////////////////////////////////////////
		function make_xscale(x,xwdt){
			var xScale = d3.time.scale()
				.domain([beginning, ending])
				.range([x, xwdt]);

			return xScale;
		}


		///////////////////////////////////////////////////////////////////
		function make_yscale(lbls, yhgt){
			var yScale = d3.scale.ordinal()
				.domain(lbls)
				.rangeBands([margin.top, yhgt]);
			return yScale;
		}

		///////////////////////////////////////////////////////////////////
		function color_selector(d,i){
			var dColorPropName;
			if (d.color) return d.color;
			if( colorPropertyName ){
				dColorPropName = d[colorPropertyName];
				if (dColorPropName === undefined) {
					return "#FFFFFF";
				}
				if ( dColorPropName ) {
					return colorCycle( dColorPropName );
				} else {
					return colorCycle(i);
				}
			}
			return colorCycle(i);
		}

		///////////////////////////////////////////////////////////////////
		gantt.draw = function(data = current_data, init = false){
			current_data = data;
			width = gParent.node().clientWidth;
			height = gParent.node().clientHeight;

			var flatdata = [];
			var labels = [];
			data.forEach(function(entry,i){
				// Little trick to avoid duplicates
				this_label = entry.label;
				while ( labels.indexOf(this_label) != -1){
					this_label = this_label + ' ';
				}
				entry.label = this_label;
				labels.push(this_label);
				flatdata.push(entry);
				show = true;
				if (entry.show_split !== undefined)
					show = entry.show_split;
				if (entry.subentries !== undefined){
					entry.subentries.forEach(function(subentry,j){
						if (show){
							// Little trick to avoid duplicates
							this_label = subentry.label;
							while ( labels.indexOf(this_label) != -1){
								this_label = this_label + ' ';
							}
							subentry.label = this_label;
							labels.push(this_label);
							flatdata.push(subentry);
						}
					});
				}
			});

			if (init){
				/////////////////////////////
				// X axis
				xScale = make_xscale(0,width+10);
				
				xAxis = d3.svg.axis()
					.scale(xScale)
					.orient(orient)
					.tickFormat(tickFormat.format)
					.tickSize(tickFormat.tickSize);

				if (tickFormat.tickValues != null) {
					xAxis.tickValues(tickFormat.tickValues);
				} else {
					xAxis.ticks(tickFormat.numTicks || tickFormat.tickTime, tickFormat.tickInterval);
				}
				gxAxis = svg.append("g")
					.attr("class", "xaxis")
					.attr("transform", "translate(" + (-10) + "," + (height+10) + ")")
					.call(xAxis);

				/////////////////////////////
				// Y axis
				yheight = Math.max((labels.length * itemHeight), (height+10));
				yScale = make_yscale(labels,yheight);

				yAxis = d3.svg.axis()
					.scale(yScale)
					.orient("left")
					.tickSize(2);
				gyAxis = svg.append("g")
					.attr("clip-path","url(#clip-alongy)")
					.append('g')
					.attr("class", "yaxis")
					.attr("transform", "translate(" + (-10) + "," + 0 + ")")
					.call(yAxis);

				/////////////////////////////
				// Chart and clip chart
				chart = svg.append("g")
					.attr("class","chart")
					.attr("clip-path","url(#clip-chart)");

				clipchart = svg.append("clipPath")
					.attr("id","clip-chart");
				clipchart.append("rect")
					.attr("width",width)
					.attr("height",height);

				clipalongy = svg.append("clipPath")
					.attr("id","clip-alongy");
				clipalongy.append("rect")
					.attr("width",width)
					.attr("height",height);

				/////////////////////////////
				// Chart decorations (Today line ...)
				chartdeco = svg.append("g")
					.attr("class","chartdeco")
					.attr("clip-path","url(#clip-chart)");
				if (showTodayLine) {
					var today = xScale(new Date());
					todayLine = chartdeco.append("line")
						.attr("x1", today)
						.attr("y1", 0)
						.attr("x2", today)
						.attr("y2", 0)
						.style("stroke", showTodayFormat.color)//"rgb(6,120,155)")
						.style("stroke-width", showTodayFormat.width);
				}

				/////////////////////////////
				// Legend
				if ( colorPropertyName ) {
					legend = svg.append('g')
						.attr('id','legend')
						.attr('transform', function(){
							posx = width * 4/5;
							return 'translate('+posx+',25)';
						});


					legend.append('rect')
						.attr('width', 0)
						.attr('height', 0)
						.style('fill', 'white')
						.style('stroke', 'black');

					legend_items = legend.selectAll('legend_items')
						.data([true])
						.enter().append('g')
						.attr('class','legend_items');

					// Set mouse cursor to drag hand 
					legend.on({
						      "mouseover": function(d) {
								          d3.select(this).style("cursor", "-webkit-grab")
								        },
						      "mouseout": function(d) {
								          d3.select(this).style("cursor", "")
								        }
						    });
				}
			}


			if (rotateTicks) {
				gxAxis.selectAll(".tick text")
					.attr("transform", function(d) {
						return "rotate(" + rotateTicks + ")translate("
							+ ((this.getBBox().width * Math.sin(rotateTicks)) / 2 ) + ","
							+ ((this.getBBox().height * Math.cos(rotateTicks)) / 2) + ")";
					});
			}

			if(!init){
				// Align text right before calculating various widths.
				// This is important to make the chart properly responsive.
				if (ylabelsleftaligned){
					gyAxis.selectAll(".tick text")
						.attr("dx", 0)	// Place 5 pixel away from left edge of axis box
						.style("text-anchor","end") // Left aligned
						;
				}
				// Update the axes to their correct position
				var gyabb = gyAxis.node().getBBox();
				yScale = make_yscale(labels,gyabb.height);
				yAxis.scale(yScale);
				gyAxis.call(yAxis);

				// Apply the style before extracting the box width
				// to take into account the font.
				gyAxis.selectAll(".tick text")
					.data(flatdata)
					.attr("class", function(d){
						if (d.class == null)
							return "ylabel_default";
						else
							return "ylabel_"+d.class;
					});

				gyabb = gyAxis.node().getBBox();

				xpos = gyabb.width + margin.left;
				xwidth = width - margin.right;
				xScale = make_xscale(xpos,xwidth);
				xAxis.scale(xScale);
				gxAxis.transition()
					.duration(axisDelay)
					.call(xAxis);
				var gxabb = gxAxis.node().getBBox();

				yheight = Math.max(
						(labels.length * itemHeight),
						(height-gxabb.height-margin.bottom));
				yScale = make_yscale(labels,yheight);
				yAxis = d3.svg.axis()
				.scale(yScale)
				.orient("left")
				.tickSize(2);
				gyAxis.transition()
					.duration(axisDelay)
					.call(yAxis);
				
				ytransX = (height-gxabb.height-margin.bottom);
				xtransY = (gyabb.width+margin.left);
				
				gxAxis.transition().duration(axisDelay)
					.delay(axisDelay)
					.attr("transform", "translate(" + 0 + "," + ytransX + ")");

				gyAxis.transition().duration(axisDelay)
					.delay(axisDelay)
					.attr("transform", "translate(" + xtransY + ',' + 0 + ")");
				if (ylabelsleftaligned){
					gyAxis.selectAll(".tick text")
						.attr("dx", 5 - gyabb.width)	// Place 5 pixel away from left edge of axis box
						.style("text-anchor","start") // Left aligned
						;
				}

				cpwidth = width - margin.right - xtransY;
				cpheight = ytransX - margin.top;

				clipchart.select("rect")
					.attr("height",cpheight)
					.attr("width", cpwidth)
					.attr("transform", "translate(" + xtransY + ',' + 0 + ")")
					.attr("x",0)
					.attr("y",margin.top);

				clipalongy.select("rect")
					.attr("height",cpheight)
					.attr("width", width)
					.attr("x",0)
					.attr("y",margin.top);

				////////////////////////////////////
				// Extract rect data
				var rectdata = [];
				var textdata = [];
				data.forEach(function (entry, i) {
					entry.times.forEach(function (time, j) {
						if (time.display == "circle" || 
							time.ending_time === undefined || time.starting_time === undefined){
							// TODO: circle
						} else {
							var rect = {};
							rect.x = xAxis.scale()(time.starting_time);
							rect.width = xAxis.scale()(time.ending_time)
										- xAxis.scale()(time.starting_time);
							rect.id = entry.label;
							rect.color = color_selector(entry, rectdata.length);

							rectdata.push(rect);

							if (time.label !== undefined && time.label !== ""){
								var text ={};
								text.x = rect.x;
								text.id = rect.id;
								text.text = time.label;
								textdata.push(text);
							}
						}
					});
					if (entry.subentries !== undefined){
						entry.subentries.forEach(function(subentry,k){
							subentry.times.forEach(function (subtime, l) {
								if (subtime.display == "circle" || 
									subtime.ending_time === undefined || subtime.starting_time === undefined){
									// TODO: circle
								} else {
									var rect = {};
									rect.x = xAxis.scale()(subtime.starting_time);
									rect.width = xAxis.scale()(subtime.ending_time)
												- xAxis.scale()(subtime.starting_time);
									rect.color = color_selector(subentry, rectdata.length);

									show = true;
									if (entry.show_split !== undefined)
										show = entry.show_split;
									if (show){
										rect.id = subentry.label;
										var text ={};
										text.x = rect.x;
										text.id = rect.id;
										text.text = subtime.label;
										textdata.push(text);
									} else {
										rect.id = entry.label;
									}
									rectdata.push(rect);
								}
							});
						});
					}
				});

				////////////////////////////////////
				// Draw the bar chart
				var bars = chart.selectAll("rect.bar")
					.data(rectdata);
				var texts = chart.selectAll("text.bar-text")
					.data(textdata, function(d){return d.id;});

				//update
				bars.style("fill", function(d,i){return d.color;});

				//enter
				bars.enter()
					.append("rect")
					.attr("class", "bar")
					.attr("width", 0)
					.attr("transform", function(d,i) {
						return "translate(" + d.x +','+ yAxis.scale()(d.id) + ")"
					})
					.style("fill", function(d,i){return d.color;});
				texts.enter()
					.append("text")
					.attr("class", "bar-text")
					.attr("alignment-baseline","middle")
					.attr("x", 5)
					.attr("y", yAxis.scale().rangeBand()/2)
					.attr("transform", function(d,i) {
						// return "translate(" + d.x +',0)';
						return "translate(" + d.x +','+ yAxis.scale()(d.id) + ")"
					})
					.attr("fill-opacity", 0.0)
					.text(function(d){return d.text;});

				//exit 
				bars.exit()
					.transition()
					.duration(axisDelay)
					.ease("exp")
					.attr("width", 0)
					.remove();

				texts.exit()
					.transition()
					.duration(axisDelay)
					.ease("exp")
					.style("fill-opacity", 1e-6)
					.remove();


				bars.attr("stroke-width", 4)
					.transition()
					.delay(axisDelay)
					.duration(axisDelay)
					.ease("quad")
					.attr("width", function(d,i){ return d.width; })
					.attr("height", yAxis.scale().rangeBand())
					.attr("transform", function(d,i) {
						return "translate(" + d.x +','+ yAxis.scale()(d.id) + ")"
					});

				texts.transition()
					.delay(axisDelay)
					.duration(axisDelay)
					.ease("quad")
					.attr("fill-opacity", 1.0)
					.attr("y", yAxis.scale().rangeBand()/2)
					.attr("transform", function(d,i) {
						var this_x = Math.max(xAxis.scale()(beginning), d.x);
						return "translate(" + this_x +','+ yAxis.scale()(d.id) + ")"
					});

				////////////////////////////////////
				// Pan Y on scroll
				var pan = function() {
					var deltaY = 0.0;
					var yStart = d3.transform(gyAxis.attr("transform")).translate[1];
					var fullHeight = gyAxis.node().getBBox().height;
					var visibleHeight = clipalongy.node().getBBox().height;
					// scroll(yScale(y), yScale);
					if (d3.event.sourceEvent.type === "wheel") {
						// use the `d3.event.sourceEvent.deltaY` value to translate
						yWheel = -1*d3.event.sourceEvent.deltaY;
						var yNew = Math.min(0, Math.max(yStart+ yWheel, -1*(fullHeight - visibleHeight)));
						deltaY = yNew - yStart;
					} else if (d3.event.sourceEvent.type === "mousemove") {
						// use the normal d3.event.translate array to translate
						// e.g., yTranslation = d3.event.translate[1];
					}
					gyAxis.attr("transform", "translate(" + xtransY+"," + (yStart+deltaY) +")");
					// Translate chart elements
					chart.selectAll('*').each(function(){
						var barPos = d3.transform(d3.select(this).attr("transform")).translate;
						d3.select(this).attr("transform", "translate(" + barPos[0] +"," + (barPos[1]+deltaY) +")");
					});
				};

				var panYOnScrollAndDrag = d3.behavior.zoom()
					.scaleExtent([1, 1]) // prevents wheel events (or anything) from changing the scale
					.on("zoom", pan);

				svg.call(panYOnScrollAndDrag);

				////////////////////////////////////
				// Draw today line
				if (showTodayLine) {
					var today = xScale(new Date());
					todayLine.transition()
						.duration(2*axisDelay)
						.delay(axisDelay)
						.attr("x1", today)
						.attr("y1", yScale.rangeExtent()[0])
						.attr("x2", today)
						.attr("y2", yScale.rangeExtent()[1]);
				}

				////////////////////////////////////
				// Draw legend
				if ( colorPropertyName ) {
					var legend_entry = legend_items.selectAll('legend_entry')
						.data(colorCycle.domain())
						.enter()
						.append('g')
						.attr('class', 'legend_entry')
						.attr('transform', function(d, i) {
							var height = legendRectSize + legendSpacing;
							var offset =  height * colorCycle.domain().length / 2;
							var horz = 10;
							var vert = i * height + 10; // - offset;
							return 'translate(' + horz + ',' + vert + ')';
						});
					legend_entry.append('rect')
						.attr('width', legendRectSize)
						.attr('height', legendRectSize)
						.style('fill', colorCycle)
						.style('stroke', colorCycle);
					legend_entry.append('text')
						.attr('x', legendRectSize + legendSpacing)
						.attr('y', legendRectSize - legendSpacing)
						.text(function(d) { return d; });
					// To make the width of the main box fit the text width
					// https://bl.ocks.org/mbostock/1160929
					var lbbox = legend_items.node().getBBox();
					var therect = legend.select('rect')
						.attr('width',lbbox.width + 20)
						.attr('height',lbbox.height + 20);

					// Set up dragging for the entire legend
					var dragMove = function () {
						var x = d3.event.x;
						var y = d3.event.y;
						d3.select(this).attr("transform", "translate(" + x + "," + y + ")");
					};

					var drag = d3.behavior.drag()
						.origin(function () {
							return {
								x: d3.transform(legend.attr("transform")).translate[0],
								y: d3.transform(legend.attr("transform")).translate[1]
							};
						})
						.on("drag", dragMove);

					legend.call(drag);
				}

			}

		}

		function gantt(Parent)
		{
			gParent = Parent;
			//setup the svg
			svg = gParent.append("svg")
				.attr("width", "100%")
				.attr("height", "100%");
			svg.append("svg:rect")
				.attr("width", "100%")
				.attr("height", "100%")
				.attr("stroke", "none")
				.attr("fill", "none");

			// Create xaxis group
			// Create yaxis group

			var data = svg.data()[0];

			find_xrange(data);

			// Create X and Y axes
			gantt.draw(data,true);

			// Draw everything
			gantt.draw(data);

			d3.select(window).on('resize', gantt.draw); 

		}
		// SETTINGS

		gantt.margin = function (p) {
			if (!arguments.length) return margin;
			margin = p;
			return gantt;
		};

		gantt.orient = function (orientation) {
			if (!arguments.length) return orient;
			orient = orientation;
			return gantt;
		};

		gantt.itemHeight = function (h) {
			if (!arguments.length) return itemHeight;
			itemHeight = h;
			return gantt;
		};

		gantt.itemMargin = function (h) {
			if (!arguments.length) return itemMargin;
			itemMargin = h;
			return gantt;
		};

		gantt.navMargin = function (h) {
			if (!arguments.length) return navMargin;
			navMargin = h;
			return gantt;
		};

		gantt.height = function (h) {
			if (!arguments.length) return height;
			height = h;
			return gantt;
		};

		gantt.width = function (w) {
			if (!arguments.length) return width;
			width = w;
			return gantt;
		};

		gantt.display = function (displayType) {
			if (!arguments.length || (DISPLAY_TYPES.indexOf(displayType) == -1)) return display;
			display = displayType;
			return gantt;
		};

		gantt.labelFormat = function(f) {
			if (!arguments.length) return labelFunction;
			labelFunction = f;
			return gantt;
		};

		gantt.tickFormat = function (format) {
			if (!arguments.length) return tickFormat;
			tickFormat = format;
			return gantt;
		};

		gantt.hover = function (hoverFunc) {
			if (!arguments.length) return hover;
			hover = hoverFunc;
			return gantt;
		};

		gantt.mouseover = function (mouseoverFunc) {
			if (!arguments.length) return mouseover;
			mouseover = mouseoverFunc;
			return gantt;
		};

		gantt.mouseout = function (mouseoutFunc) {
			if (!arguments.length) return mouseout;
			mouseout = mouseoutFunc;
			return gantt;
		};

		gantt.click = function (clickFunc) {
			if (!arguments.length) return click;
			click = clickFunc;
			return gantt;
		};

		gantt.scroll = function (scrollFunc) {
			if (!arguments.length) return scroll;
			scroll = scrollFunc;
			return gantt;
		};

		gantt.colors = function (colorFormat) {
			if (!arguments.length) return colorCycle;
			colorCycle = colorFormat;
			return gantt;
		};

		gantt.beginning = function (b) {
			if (!arguments.length) return beginning;
			beginning = b;
			return gantt;
		};

		gantt.ending = function (e) {
			if (!arguments.length) return ending;
			ending = e;
			return gantt;
		};

		gantt.labelMargin = function (m) {
			if (!arguments.length) return labelMargin;
			labelMargin = m;
			return gantt;
		};

		gantt.rotateTicks = function (degrees) {
			if (!arguments.length) return rotateTicks;
			rotateTicks = degrees;
			return gantt;
		};

		gantt.ylabelsleftaligned = function () {
			ylabelsleftaligned = !ylabelsleftaligned;
			return gantt;
		};

		gantt.stack = function () {
			stacked = !stacked;
			return gantt;
		};

		gantt.showBorderFormat = function(borderFormat) {
			if (!arguments.length) return showBorderFormat;
			showBorderFormat = borderFormat;
			return gantt;
		};

		gantt.showToday = function () {
			showTodayLine = !showTodayLine;
			return gantt;
		};

		gantt.showTodayFormat = function(todayFormat) {
			if (!arguments.length) return showTodayFormat;
			showTodayFormat = todayFormat;
			return gantt;
		};

		gantt.colorProperty = function(colorProp) {
			if (!arguments.length) return colorPropertyName;
			colorPropertyName = colorProp;
			return gantt;
		};

		gantt.rowSeparators = function (color) {
			if (!arguments.length) return rowSeparatorsColor;
			rowSeparatorsColor = color;
			return gantt;

		};

		gantt.background = function (color) {
			if (!arguments.length) return backgroundColor;
			backgroundColor = color;
			return gantt;
		};

		gantt.showTimeAxis = function () {
			showTimeAxis = !showTimeAxis;
			return gantt;
		};

		gantt.showTimeAxisTick = function () {
			timeAxisTick = !timeAxisTick;
			return gantt;
		};



		return gantt;

	};

})();
