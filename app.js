const jsdom = require('jsdom-global');
const request = require('request');
const express = require('express');
const app = express();

const mysql = require('mysql');
const vis = require('vis');

const serverPort = 4001;
const serverHost = 'localhost';
const mysqlConnection = mysql.createConnection({
	host: 'localhost',
	user: 'root',
	password: '',
	database: 'eni_network_simulator'
});

mysqlConnection.connect();
//style="width:1000px;height:1000px;"
jsdom('<div id="networkDiv" ></div>', {skipWindowCheck: true});
let container = document.getElementById('networkDiv');
let data = {
	nodes: [],
	edges: []
};
let options = {
    nodes: {},
    edges: {
        smooth: {
            type: 'continuous'
        }
    },
    physics: {
        enabled: true,
        repulsion: {
            nodeDistance: 200
        },
        solver: 'repulsion',
        stabilization: {
            iterations: 1000 
        }
    },
    layout: {
    	randomSeed: 1,
    	improvedLayout: true 
    }
};

app.get('/test', 
	(req, res) => res.send('nodejs component is running!!')
);

app.get('/update-coordinates',
	(req, res) => {
		data.nodes = [];
		data.edges = [];
		let getNodesFromDB = new Promise((resolve, regenct) => {
			mysqlConnection.query('select * from node', 
				(err, rows, fields) => {
					if (err) throw err;
					
					for (const row of rows) {
						data.nodes.push({
							id:row.id, 
							x:row.x, 
							y:row.y
						});
					}
					
					resolve();
				}
			);
		}).then(() => {
			let getEdgesFromDB = new Promise((resolve, regenct) => {
				mysqlConnection.query('select * from edge', 
					(err, rows, fields) => {
						if (err) throw err;
						
						let i = 0;
						for (const row of rows) {
							data.edges.push({
								to:row.nodeIdA, 
								from:row.nodeIdB
							});
						}
						
						resolve();
					}
				);
			}).then(() => {
				let getNodePositions = new Promise((resolve, regenct) => {
					let network = new vis.Network(container, data, options);
					network.once('stabilized', params => {
						console.log('stabilized', params);
						//network.storePositions();
						resolve(network.getPositions());
					});
					network.on("stabilizationProgress", params => {
						if ( params.iterations >= params.total) {
							network.stopSimulation();
						}
					});
				}).then((positions) => {
					// update coordinates in data object
					for (const node of data.nodes) {
						node.x = positions[node.id].x;
						node.y = positions[node.id].y;
					}
					
					let rowCount = Object.keys(positions).length;
					
					// update coordinates in db
					for (const position in positions) {
						let updatePositionsInDB = new Promise((resolve, regenct) => {
							mysqlConnection.query('update node set x = ?, y = ? where id = ?',
								[positions[position].x, positions[position].y, position],
								(err, rows, fields) => {
									if (err) throw err;
									
									resolve(position);
								}
							);
						}).then((nodeId) => {
							rowCount--;
							
							if (rowCount <= 0) {
								// mysql connections is created outside this request
								// we use single connection that will be terminated 
								// with the node node server
								/*mysqlConnection.end(err => {
									console.log('mysql disconnected');
								});*/
								// now send a notification to tomcat
								// so that layout can be updated on client side
								request.post('http://localhost:8095/ENINetworkSimulator/fe/node-coordinates-updated', 
									{},
									function (error, response, body) {
										if (!error && response.statusCode == 200) {
											console.log(body);
										}
									}
								);
							}
						});
					}
					
					res.json(data);
				});
			});
		});
	}
);

app.get('/coordinates-upto-date',
	(req, res) => {
		res.json();
	}
);

app.listen(serverPort, () => console.log('app running @ http://'+serverHost+':'+serverPort));
