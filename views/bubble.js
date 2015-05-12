var sampleData = [{"name":"one", "value": 10}, {"name":"two", "value": 20}, {"name":"three", "value": 30}]; 

//var data = [{"name": "Root","children": [{"name": "Leaf1","children": null,"value": 2098629},{"name": "Leaf2","children": null,"value": 104720}]}];
// var data = [{"value": 4, "name": "top_level", "children": [{"value": 2, "name": "www.reddit.com", "children": [{"value": 2, "name": "r", "children": [{"value": 1, "name": "sports"}, {"value": 1, "name": "funny"}]}]}, {"value": 2, "name": "stackoverflow.com", "children": [{"value": 1, "name": "questions"}, {"value": 1, "name": "tags"}]}]}];

var w = $(window).width()*0.75,
    h = $(window).height()*0.75,
    r = Math.min(w, h)*0.75,
    x = d3.scale.linear().range([0, r]),
    y = d3.scale.linear().range([0, r]);

var diameter = 2*r,
format = d3.format(",d"),
color = d3.scale.category20c();

var node, root;

$.get('/getKmeansClusters', function(data) {
  var canvas = d3.select("body").append("svg")
    .attr("width", w)
    .attr("height", h)
    .append("g")
    .attr("transform", "translate("+x/2+", "+y/2+")")
    .sort(null);

var pack = d3.layout.pack()
.size([w, h - 50])
.padding(10);

/*centerNodes(nodes);
makePositionsRelativeToZero(nodes);*/

node = root = data;

var nodes = pack.nodes(data[0]);

var node = canvas.selectAll(".node")
.data(nodes)
.enter()
.append("g")
.attr("class", "node")
.attr("transform", function(d) {return "translate("+ d.x + "," + d.y +")"; });

node.append("title")
.text(function(d) { return d.name + ": " + d.value; });

node.append("circle")
.attr("r", function(d) { return d.r; })
.style("fill", function(d) { return color(d.name); })
.on("click", function(d) {
    $.post('/setCluster', {clusterNum: d.clusterNum}, 
        function(data, status){
            console.log(data);
        });
    window.location.href = '/displayCluster';
});

node.append("text")
.attr("dy", ".3em")
.text(function (d) {return d.name;})
.style("text-anchor", "middle")
.style('fill',"white");
});


