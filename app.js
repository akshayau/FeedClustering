var http = require("http"), 
	util = require('util'), 
	fs = require('fs'), 
	url = require('url')
	qs = require('querystring')
	gfeed = require('google-feed-api')
	natural = require('natural'), 
	TfIdf = natural.TfIdf, 
	tfidf = new TfIdf(), 
	clusterfck = require('clusterfck'), 
	read = require('node-readability'), 
	express = require('express'),
    stylus = require('stylus'),
    nib = require('nib'), 
    bodyParser = require('body-parser'); 

var app = express()
function compile(str, path) {
  return stylus(str)
    .set('filename', path)
    .use(nib())
}
app.set('views', __dirname + '/views')
app.set('view engine', 'jade')
app.use(express.logger('dev'))
app.use(stylus.middleware(
  { src: __dirname + '/public'
  , compile: compile
  }
))
app.use(express.static(__dirname + '/public'))
app.use(bodyParser());

app.get('/favicon.ico', function(req, res) {
  res.render('form');
});

app.get('/', function(req, res) {
  res.render('form');
});

var kMeansData = []; 
app.get('/getKmeansClusters', function(req, res) {

  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(kMeansData));
});

var hierData = [];
app.get('/getHierarchical', function(req, res) {

  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(hierData));
});

function convert(input, rootName) {
    // top level
    if (Array.isArray(input)) {
        return {
            "value": rootName,
            "children": input.map(convert)
        };
    }
    // node
    else {
        ['left', 'right'].forEach(function(side) {
            if (input[side]) {
                input.children = input.children || [];
                input.children.push(convert(input[side]));
                delete input[side];
            }
        });
        return input;
    }
}

function groupClusters(numClusters, clusterTree) {
	clusterArr = [clusterTree];
	while (clusterArr.length < numClusters) {
		var data = clusterArr[0];
		if (data.size == 1) 
			clusterArr.push(data);
		else {
			clusterArr.push(data.left); 
			clusterArr.push(data.right);	
		}	
		clusterArr = clusterArr.slice(1, clusterArr.length);			
	}
	return extractValues(clusterArr);
	
}

function extractValuesHelper(tree, valArr, count) { 
  if (tree.value != undefined) {
    valArr[count-1] = tree.value; 
    return [valArr, count-1];
  }
  else {
    leftVals = extractValuesHelper(tree.left, valArr, count); 
    return extractValuesHelper(tree.right, leftVals[0], leftVals[1]); 
  } 
}

function extractValues(treeArr) {
  var arr = []; 
  for (var i = 0; i < treeArr.length; i++) {
    var len = treeArr[i].size; 
    var valArr = [];
    while(len--) valArr.push([]);
    vals = extractValuesHelper(treeArr[i], valArr, treeArr[i].size);
    arr.push(vals[0]);
  }
  return arr;
}

var docArr = [];
var hclusters; 
var matrix; 
var randIndex = -1; 
var groupedDocs = []; 
var linkage; 
var distance; 

app.post('/', function(req, res) {
	var feedList = req.body.feedList;
	var articles = req.body.articles; 
	var clusters = req.body.clusters;  
	var clusterType = req.body.clusterType;
	linkage = req.body.linkage; 
	distance = req.body.distance; 
	var output = []; 
	var dictionary = [];
	var docs = 0; 
	docArr = []; 

	var urls = feedList.trim().replace(/(\r\n|\n|\r)/gm,"").split(",");
	console.log(urls); 
	var i; 
	for (i = 0; i < urls.length; i++) {
		var feed = new gfeed.Feed(urls[i].trim()); 

		feed.setNumEntries(articles);
  		feed.includeHistoricalEntries();

  		feed.load(function (result) {
  			if (!result.error) {
  				//create tf-idf 
  				for (var j = 0; j < result.feed.entries.length; j++) {
  					var entry = result.feed.entries[j];
		            tfidf.addDocument(entry.title);
		            docs++;
		            docArr.push(entry);
  				}

  				//construct dictionary 
				for (var j = 0; j < result.feed.entries.length; j++) {
					tfidf.listTerms(j).forEach(function (item) {
						if (dictionary.indexOf(item.term) < 0)
							dictionary.push(item.term); 
					});
				}
				if (docs === (urls.length * articles)) {
					//construct tf-idft matrix 
					matrix = []; 
					for (var doc = 0; doc < docs; doc++) {
						var row = [];
						dictionary.forEach(function (term) {
							row.push(tfidf.tfidf(term, doc));
						}); 
						matrix.push(row);
					}

					// hierarchical clustering  
					hclusters = clusterfck.hcluster(matrix, distance, linkage);
					temp = hclusters;  
					var d3hclusters = convert([temp], "root"); 
					hierData = [d3hclusters, matrix, docArr];

					if (clusterType == 'hierarchical') {
						res.render('branch', {randIndex: "Not calculated", 
								linkage: capitalizeFirstLetter(linkage), 
								distance: capitalizeFirstLetter(distance)});
					}

					// kmeans clustering
					var kmeans = new clusterfck.Kmeans(); 
					var kclusters = kmeans.cluster(matrix, clusters);

					// construct array of arrays of grouped docs 
					groupedDocs = []; 
					var len = clusters;
					while(len--) groupedDocs.push([]);
					
					var rss = 0.0; 

					for (var j = 0; j < docs; j++) {
						var ind = kmeans.classify(matrix[j]);
						groupedDocs[ind].push(docArr[j]);
						
						// also calculate residual sum of squares
						for (var k = 0; k < dictionary.length; k++) {
							delta = kclusters[ind][0][k] - matrix[j][k];
							rss = rss + delta*delta; 
						}
					}

					// get most frequent terms 
					var centroids = kmeans.centroids;
					kMeansData = [];
					kMeansData.push({"name": "root", "children": []}); 
					for (var j = 0; j < centroids.length; j++) {
						var zip = centroids[j].map(function (e, i) {
							return [centroids[j][i], dictionary[i]];
						});

						zip.sort(function(a,b) {return b[0] - a[0]}); 
						kMeansData[0].children.push({"name": zip[0][1], "value": groupedDocs[j].length, "clusterNum": j, "children": null});
					}
					
					res.render('bubble', 
						{rss: rss});
				}
  					
  			}
  		});
	}

});

function capitalizeFirstLetter(string) {
    return string.charAt(0).toUpperCase() + string.slice(1);
}

app.post('/renderEval', function(req, res) {
	res.render('evaluate', {arr: docArr});
});

var displayCluster; 
var clusterNum; 
app.post('/setCluster', function(req, res) {
	clusterNum = req.body.clusterNum;
	displayCluster = groupedDocs[clusterNum];
});

app.get('/displayCluster', function(req, res) {
	res.render('clusterList', {arr: displayCluster, topTerm: kMeansData[0].children[clusterNum].name});
});

app.post('/evaluate', function(req, res) {
	var docClusters = req.body.docClusters; 
	var totalClusters = req.body.totalClusters;
	var clusterGroups = groupClusters(totalClusters, clusterfck.hcluster(matrix, distance, linkage));

	var goldMap = []; 
	for(var i = 0; i < docClusters.length; i++) {
		goldMap[matrix[i]] = docClusters[i];
	}

	var genMap = []; 
	for(var i = 0; i < clusterGroups.length; i++) {
		for(var j = 0; j < clusterGroups[i].length; j++) {
			genMap[clusterGroups[i][j]] = i; 
		}
	}

	var similarPairs = 0;
	var dissimilarPairs = 0; 
	var N = matrix.length;

	for(var i = 0; i < N; i++) {
		for(var j = 0; j < N; j++) {
			if(i != j) {
				//similar pair in same cluster? 
				if ((goldMap[matrix[i]] == goldMap[matrix[j]]) && (genMap[matrix[i]] == genMap[matrix[j]])) {
					similarPairs++;
				}
				if ((goldMap[matrix[i]] != goldMap[matrix[j]]) && (genMap[matrix[i]] != genMap[matrix[j]])) {
					dissimilarPairs++;
				}
			}
		}
	}

	randIndex = (similarPairs + dissimilarPairs) / ((N*(N-1))/2) 
	res.render('branch', {randIndex: randIndex, 
				linkage: capitalizeFirstLetter(linkage), 
				distance: capitalizeFirstLetter(distance)});
});

app.listen(8080); 
console.log('Server listening at localhost:8080'); 