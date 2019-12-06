d3.queue()
  .defer(d3.json, "./map.json")
  .defer(d3.csv, "./urbanpercentage.csv")
  .defer(d3.json, "./countrycode.json")
  .defer(d3.csv, "./totalpop.csv")
  .await(function(error, mapData, urbanData, countryData, totalPop){
    //sort through data
    var geoData = topojson.feature(mapData, mapData.objects.countries).features;
    urbanData.forEach(function(f){
      //go through all the urban data and match country codes
      var country = countryData.filter(d=>{
        return d["alpha-3"]== f["Country Code"]})
      country.forEach(function(d){
        f.id = d["country-code"];
        f.region = d["region"]
      })
      //filter through population data and find country with correct alpha-3 num
      var popData = totalPop.filter(d=>{
        return d["Country Code"]== f["Country Code"]})
      popData.forEach(function(d){
        f.popData = d
      })
      var countries = geoData.filter(d=> d.id === f.id);
      countries.forEach(d=> d.properties = f)
    })
    //set up

    var width = 1200;
    var height = 450;

    var projection = d3.geoMercator()
                        .scale(110)
                        .translate([width/4+40, height/2+50])

    var path = d3.geoPath()
                  .projection(projection)

    //draw map
    d3.select("svg")
        .attr("width", width)
        .attr("height", height)
      .selectAll(".country")
      .data(geoData)
      .enter()
        .append("path")
        .classed("country", true)
        .attr("d", path)
        .on("click", d=> {
          drawBar(d.properties["Country Code"])
          changeBarText(d.properties)
        })
        .on("mousemove", showTooltip)
        .on("mouseout", hideTooltip)

    //initialize start map
    setColor("2016")

    //set up range input
    d3.select("input")
      .property("min", "1989")
      .property("max", "2016")
      .property("value", "2016")
      .on("input", function(d){
        var newYear = d3.event.target.value
        setColor(newYear.toString())
        changeText(newYear)
        drawPie(newYear)

      })

      //draw header text
      d3.select("svg")
          .append("text")
              .classed("header", true)
              .attr("x", width/2)
              .attr("y", 20)
              .style("text-anchor", "middle")
              .text("Showing Urban Data for 2016")


    d3.select("svg")
      .append("text")
          .classed("barHeader", true)
          .attr("x", width/2+300)
          .attr("y", height/3+75)
          .style("text-anchor", "middle")
          .text("Click on a Country to show Yearly Stats")
    //set up smaller charts

    var pieChart = d3.select("svg")
                      .append("g")
                        .attr("transform", `translate(${width/4*3}, ${height/4})`)
                        .classed("pie", true)

    var barChart = d3.select("svg")
                      .append("g")
                        .attr("transform", `translate(${width/2+160}, ${height/3+60})`)
                        .classed("bar", true)

    var scatterChart = d3.select("svg")
                          .append("g")
                            .attr("transform", `translate(${width/2}, ${height/2})`)
                            .classed("scatter", true)

    //set up tooltips
    var tooltip = d3.select("body")
                    .append("div")
                      .classed("tooltip", true)

    var barTooltip = d3.select("body")
                        .append("div")
                          .classed("barTooltip", true)

    var pieTooltip = d3.select("body")
                        .append("div")
                          .classed("pieTooltip", true)


    function drawPie(year){

        var cleanData = urbanData.filter(d=> d.region)
        var regions = ["Oceania", "Europe", "Africa", "Americas", "Asia"]

        var colorScale = d3.scaleOrdinal()
                          .domain(regions)
                          .range(["yellow", "blue", "purple", "orange", "red"])

        var arcs = d3.pie()
                      .value(d=> d.popData[year])
                      .sort(function(a, b){

                        if(regions.indexOf(a.region) > regions.indexOf(b.region)) return -1;
                        else if(regions.indexOf(a.region) < regions.indexOf(b.region)) return 1;
                        else return a.popData[year] - b.popData[year]
                      })
                      (cleanData)


        var path = d3.arc()
                      .outerRadius(100)
                      .innerRadius(20)

        var update = d3.select(".pie")
                        .selectAll(".arc")
                        .data(arcs)
        update
          .exit()
          .remove()

        update
          .enter()
          .append("path")
              .classed("arc", true)
              .each(d=> this._current = d)
          .merge(update)
              .on("mousemove", showPieTooltip)
              .on("mouseout", hideTooltip)
              .transition()
              .duration(1000)
              .attrTween("d", arcTween)
              .attr("fill", d=>{
                if(!d.data.region) return "#ccc"
                return colorScale(d.data.region)
              })
              .attr("stroke", "#ccc")
              .attr("d", path)

      function arcTween(a) {

        var i = d3.interpolate(this._current, a);
        this._current = i(0);
        return function(t) {
          return arc(i(t));
        };
      }

        function showPieTooltip(d){
            pieTooltip
              .style("left", (d3.event.x - barTooltip.node().offsetWidth/2) + "px")
              .style("top", d => {
                var ttHeight = barTooltip.node().offsetHeight
                if(window.innerHeight - d3.event.y- 50 < ttHeight){
                  return (d3.event.y - ttHeight - 10) + "px"
                }
                return (d3.event.y + 10)+ "px"
              })
              .style("opacity", 1)
              .html(`<p>${d.data["Country Name"]}</p>
                <p>${(+d.data.popData[year]).toLocaleString()}</p>
                `)
              }
    }


    function drawBar(countryCode){
      var chartWidth = 300;
      var chartHeight = 250;
      var barPadding = 1;
      var found = urbanData.filter( country => country["Country Code"] === countryCode)
      var data = []
      for(let key in found[0]){
        if(isFinite(key) && found[0][key].length>0){
          data.push({year: key, urbanPercentage: found[0][key]})
        }
      }
      var barWidth = chartWidth/data.length - barPadding
      var yScale = d3.scaleLinear()
                      .domain([0, 100])
                      .range([chartHeight, 0])

      var bars = barChart
        .selectAll("rect")
        .data(data, d=> d.year)

      bars
        .exit()
        .remove()

      bars
        .enter()
          .append("rect")
        .merge(bars)
          .on("mousemove", showBarTooltip)
          .on("mouseout", hideTooltip)
          .transition()
          .duration(1000)
          .delay((d, i)=> i*15)
          .ease(d3.easeBackOut)
          .attr("width", barWidth)
          .attr("height", function(d){
            return chartHeight - yScale(d.urbanPercentage)
          })
          .attr("y", d=> yScale(d.urbanPercentage))
          .attr("x", (d, i)=> {
            return (barWidth + barPadding) * i
          })
          .attr("fill", "orange")

    }

    function drawScatter(year){
      var filteredData = urbanData.filter(d=>{
        if(d[year] && d[year].length>0 && d.popData[year] && d.popData[year].length>0){
          return d
        }
      })
      var sWidth = 200;
      var sHeight = 200;
      //x is total population
      //y is percentage of urban population
      var xScale = d3.scaleLinear()
                      .domain(d3.extent(filteredData, d=> +d.popData[year]))
                      .range([0, sWidth])
                    //["10002", "96311"]
      var yScale = d3.scaleLinear()
                      .domain(d3.extent(filteredData, d=> +d[year]))
                      .range([sHeight, 0])

      var circles = scatterChart
                      .selectAll("circle")
                      .data(filteredData, d=> d["Country Name"])

      circles
        .exit()
        .remove()

      circles
        .enter()
        .append("circle")
        .merge(circles)
          .attr("cx", d=>{
            return xScale(d.popData[year])
          })
          .attr("cy", d=> yScale(d[year]))
          .attr("fill", "black")
          .attr("r", "3px")

    }

        function showTooltip(d){
          var y = d3.select("input").property("value")
          tooltip
            .style("left", d=> {
              if(d3.event.x - tooltip.node().offsetWidth/2 < 50){
                return d3.event.x + "px"
              }
              return (d3.event.x - tooltip.node().offsetWidth/2) + "px"
            })
            .style("top", d=> {
              if(d3.event.y > window.innerHeight/2){
                return (d3.event.y - tooltip.node().offsetHeight - 20)+ "px"
              } else return (d3.event.y + 20)+ "px"

            })
            .style("opacity", 1)
            .html(`<p>${d.properties["Country Name"]} Data for ${y}</p>
              <p>Total Urban Population: ${d.properties.popData[y]}</p>
              <p>Urban Percentage: ${d.properties[y]} %</p>
            `)
        }

        function hideTooltip(d){
          tooltip
            .style("opacity", 0)
          barTooltip
            .style("opacity", 0)
          pieTooltip
            .style("opacity", 0)
        }

    function showBarTooltip(d){
      barTooltip
        .style("left", (d3.event.x - barTooltip.node().offsetWidth/2) + "px")
        .style("top", d => {
          var ttHeight = barTooltip.node().offsetHeight
          if(window.innerHeight - d3.event.y- 50 < ttHeight){
            return (d3.event.y - ttHeight - 10) + "px"
          }
          return (d3.event.y + 10)+ "px"
        })
        .style("opacity", 1)
        .html(`<p>${d.year}</p>
          <p>${(+d.urbanPercentage).toFixed(2)} %</p>
          `)
    }

    function changeText(year){
      d3.select(".header")
        .text("Showing Urban Data for " + year)
    }

    function changeBarText(d){
      d3.select(".barHeader")
        .text("Yearly Statistics for "+d["Country Name"])

    }

    function setColor(year){
      var colorScale = d3.scaleLinear()
                          .domain([0, 30, 70, d3.max(urbanData, d=> d[year])])
                          .range(["white", "#40E5DF", "#029590", "#012625"])

      d3.selectAll('.country')
        .transition()
        .duration(200)
        .attr("fill", d=> {
          if(d.properties && d.properties[year]>10){
            return colorScale(d.properties[year])
          } else{
            return "#ccc"
          }
        })
    }



  })
