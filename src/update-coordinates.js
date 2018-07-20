var http = require('http');

let serverPort = 4001;
let serverHost = 'localhost'

let server = http.createServer();
server.on('request', 
	function (request, response) {
		//console.log(request, response);
		
		const {headers, method, url} = request;
	
		let data = [];
		request.on('data', function(chunk) {
			data.push(chunk);
			//console.log('chunk ',chunk);
		});
		request.on('error', (error) => {
			console.log(error);
		});
		request.on('end', function() {
			data = Buffer.concat(data).toString();
			console.log(data);
			console.log(headers, method, url);
			response.writeHead(200, {'Content-Type': 'application/json;charset=UTF-8'});
			response.write('Hello World\n'+data);
			response.end();
		});
	}
);
server.listen(serverPort, serverHost);

console.log('Server running at http://'+serverHost+':'+serverPort+'/');