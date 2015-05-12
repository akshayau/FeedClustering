var width = $(window).width(),
    height = $(window).height()-100,
    r = Math.min(width, height),
    x = d3.scale.linear().range([0, r]),
    y = d3.scale.linear().range([0, r]);

var cluster = d3.layout.cluster()
    .size([height, width*0.5]);

var diagonal = d3.svg.diagonal()
    .projection(function(d) { return [d.y, d.x]; });

var svg = d3.select("body").append("svg")
    .attr("width", width)
    .attr("height", height)
  .append("g")
    .attr("transform", "translate(40,0)");

function getDocId(docVector, matrix) {
    console.log(matrix);
    console.log(docVector);
    for (var i = 0; i < matrix.length; i++) {
        var equal = 1; 
        for (var j = 0; j < docVector.length; j++) {
            if (docVector[j] != matrix[i][j]) {
                equal = 0; 
                break;
            }
        }
        if (equal == 1) {
            console.log(i);
            return i;
        } 
    }
    return -1; 
}

$.get('http://localhost:8080/getHierarchical', function(data) {
    root = data[0]; 
    matrix = data[1]; 
    docArr = data[2];

    var nodes = cluster.nodes(root),
        links = cluster.links(nodes);

    var link = svg.selectAll(".link")
        .data(links)
      .enter().append("path")
        .attr("class", "link")
        .attr("d", diagonal)
        .attr("fill", "none")
        .attr("stroke", "#ccc")
        .attr("stroke-width", "1.5px");

    var node = svg.selectAll(".node")
        .data(nodes)
      .enter().append("g")
        .attr("class", "node")
        .attr("transform", function(d) { return "translate(" + d.y + "," + d.x + ")"; })

    node.append("circle")
        .attr("r", 4.5)
        .attr("fill", "#fff")
        .attr('stroke', "steelblue")
        .attr('stroke-width', "1.5px");

    node.append("text")
        .attr("dx", function(d) { return d.children ? -8 : 8; })
        .attr("dy", 3)
        .style("text-anchor", function(d) { return d.children ? "end" : "start"; })
        .text(function(d) { 
            return (d.value == "root" || !d.value) ? "" : docArr[getDocId(d.value, matrix)].title; })
        .on("click", function(d) { 
            return (d.value == "root" || !d.value) ? "" : window.open(docArr[getDocId(d.value, matrix)].link); });
        //.attr("xlink:href", function (d) { docArr[getDocId(d.value, matrix)].link; });
}); 

d3.select(self.frameElement).style("height", height + "px");