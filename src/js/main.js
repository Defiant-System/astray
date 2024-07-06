
const { Maze, Box2D, Stats, THREE } = await window.fetch("~/js/bundle.js");

let scene = new THREE.Scene();
let ratio = window.innerWidth / window.innerHeight;
let camera = new THREE.PerspectiveCamera(60, ratio, 0.1, 1000 );
let renderer = new THREE.WebGLRenderer({ antialias: true });
let ambientLight = new THREE.AmbientLight(0xffffff, 0.25);
let pointLight = new THREE.PointLight(0xffffff, 1);

renderer.setSize(window.innerWidth, window.innerHeight);
camera.position.set(1, 1, 5);
pointLight.position.set(1, 1, 1.3);

scene.add(ambientLight);
scene.add(pointLight);

let Keys = {},
	ballTexture   = THREE.ImageUtils.loadTexture("~/img/bb8.jpg"),
	planeTexture  = THREE.ImageUtils.loadTexture("~/img/concrete.jpg"),
	brickTexture  = THREE.ImageUtils.loadTexture("~/img/wall.jpg"),
	gameState     = undefined,
	light         = undefined,
	stats         = undefined,
	mouseX        = undefined,
	mouseY        = undefined,
	maze          = undefined, 
	mazeMesh      = undefined,
	mazeDimension = 11,
	planeMesh     = undefined,
	ballMesh      = undefined,
	ballRadius    = 0.25,
	// Box2D shortcuts
	b2World        = Box2D.Dynamics.b2World,
	b2FixtureDef   = Box2D.Dynamics.b2FixtureDef,
	b2BodyDef      = Box2D.Dynamics.b2BodyDef,
	b2Body		   = Box2D.Dynamics.b2Body,
	b2CircleShape  = Box2D.Collision.Shapes.b2CircleShape,
	b2PolygonShape = Box2D.Collision.Shapes.b2PolygonShape,
	b2Vec2         = Box2D.Common.Math.b2Vec2,
	// Box2D world variables 
	wWorld         = undefined,
	wBall          = undefined;


const astray = {
	init() {
		// fast references
		this.content = window.find("content");
		// add renderer canvas to window body
		this.content.append(renderer.domElement);
		// add stats monitor
		stats = new Stats();
		stats.domElement.className = "stats";
		this.content.append(stats.domElement);

		let Self = this;

		// create FPS controller
		this.fpsControl = karaqu.FpsControl({
			fps: 60,
			callback() {
				Self.updatePhysicsWorld();
				Self.updateRenderWorld();
				renderer.render(scene, camera);
				stats.update();

				// Self.checkForVictory();
			}
		});

		this.dispatch({ type: "init-level" });
	},
	dispatch(event) {
		let Self = astray,
			value,
			el;
		// console.log(event);
		switch (event.type) {
			// system events
			case "window.keystroke":
				if (gameState === "play") {
					switch (event.keyCode) {
						case 65: // a
						case 37: Keys.left = true; break;
						case 68: // d
						case 39: Keys.right = true; break;
						case 87: // w
						case 38: Keys.up = true; break;
						case 83: // s
						case 40: Keys.down = true; break;
					}
				}
				break;
			case "window.keyup":
				if (gameState === "play") {
					switch (event.keyCode) {
						case 65: // a
						case 37: Keys.left = false; break;
						case 68: // d
						case 39: Keys.right = false; break;
						case 87: // w
						case 38: Keys.up = false; break;
						case 83: // s
						case 40: Keys.down = false; break;
					}
				}
				break;
			// gamepad support
			case "gamepad.up":
				if (event.button === "b0" && Self.content.hasClass("maze-solved")) {
					Self.dispatch({ type: "close-congratulations" });
				}
				break;
			case "gamepad.stick":
				// reset input
				Keys.left =
				Keys.right =
				Keys.up =
				Keys.down = false;

				if (event.value[0] !== 0) {
					value = event.value[0] > 0;
					Keys.left = !value;
					Keys.right = value;
				}
				if (event.value[1] !== 0) {
					value = event.value[1] > 0;
					Keys.up = !value;
					Keys.down = value;
				}
				break;
			case "window.focus":
				Self.fpsControl.start();
				break;
			case "window.blur":
				Self.fpsControl.stop();
				break;
			case "open-help":
				karaqu.shell("fs -u '~/help/index.md'");
				break;
			// custom events
			case "close-congratulations":
			case "init-level":
				Self.content.removeClass("maze-solved");

				maze = Maze.generate(mazeDimension);
				maze[mazeDimension-1][mazeDimension-2] = false;
				// set game state to playing
				gameState = "play";

				// let level = Math.floor((mazeDimension-1)/2 - 4);
				// console.log( level );

				// reset keys
				Keys = {};

				Self.createPhysicsWorld();
				Self.createRenderWorld();
				Self.fpsControl.start();
				break;
			case "level-solved":
				Self.fpsControl.stop();

				// set game state to paused
				gameState = "pause";

				Self.content.addClass("maze-solved");
				break;
		}
	},
	createPhysicsWorld() {
		// Create the world object.
		wWorld = new b2World(new b2Vec2(0, 0), true);

		// Create the ball.
		var bodyDef = new b2BodyDef();
		bodyDef.type = b2Body.b2_dynamicBody;
		bodyDef.position.Set(1, 1);
		wBall = wWorld.CreateBody(bodyDef);
		var fixDef = new b2FixtureDef();
		fixDef.density = 1.0;
		fixDef.friction = 0.0;
		fixDef.restitution = 0.25;
		fixDef.shape = new b2CircleShape(ballRadius);
		wBall.CreateFixture(fixDef);

		// Create the maze.
		bodyDef.type = b2Body.b2_staticBody;
		fixDef.shape = new b2PolygonShape();
		fixDef.shape.SetAsBox(0.5, 0.5);
		for (var i = 0; i < maze.dimension; i++) {
			for (var j = 0; j < maze.dimension; j++) {
				if (maze[i][j]) {
					bodyDef.position.x = i;
					bodyDef.position.y = j;
					wWorld.CreateBody(bodyDef).CreateFixture(fixDef);
				}
			}
		}
	},
	generateMazeMesh(field) {
		var dummy = new THREE.Geometry();
		for (var i = 0; i < field.dimension; i++) {
			for (var j = 0; j < field.dimension; j++) {
				if (field[i][j]) {
					var geometry = new THREE.CubeGeometry(1,1,1,1,1,1);
					var mesh_ij = new THREE.Mesh(geometry);
					mesh_ij.position.x = i;
					mesh_ij.position.y = j;
					mesh_ij.position.z = 0.5;
					THREE.GeometryUtils.merge(dummy, mesh_ij);
				}
			}
		}
		var material = new THREE.MeshPhongMaterial({ map: brickTexture });
		var mesh = new THREE.Mesh(dummy, material)
		return mesh;
	},
	createRenderWorld() {
		// Create the scene object.
		scene = new THREE.Scene();

		// Add the light.
		light= new THREE.PointLight(0xffffff, 1);
		light.position.set(1, 1, 1.3);
		scene.add(light);
		
		// Add the ball.
		let g = new THREE.SphereGeometry(ballRadius, 32, 16);
		let m = new THREE.MeshPhongMaterial({ map: ballTexture });
		ballMesh = new THREE.Mesh(g, m);
		ballMesh.position.set(1, 1, ballRadius);
		scene.add(ballMesh);

		// Add the camera.
		var aspect = window.innerWidth/window.innerHeight;
		camera = new THREE.PerspectiveCamera(60, aspect, 1, 1000);
		camera.position.set(1, 1, 5);
		scene.add(camera);

		// Add the maze.
		mazeMesh = this.generateMazeMesh(maze);
		scene.add(mazeMesh);

		// Add the ground.
		g = new THREE.PlaneGeometry(mazeDimension*10, mazeDimension*10, mazeDimension, mazeDimension);
		planeTexture.wrapS = planeTexture.wrapT = THREE.RepeatWrapping;
		planeTexture.repeat.set(mazeDimension*5, mazeDimension*5);
		m = new THREE.MeshPhongMaterial({ map: planeTexture });
		planeMesh = new THREE.Mesh(g, m);
		planeMesh.position.set((mazeDimension-1)/2, (mazeDimension-1)/2, 0);
		planeMesh.rotation.set(Math.PI/2, 0, 0);
		scene.add(planeMesh);                
	},
	updatePhysicsWorld() {
		// Apply "friction". 
		var lv = wBall.GetLinearVelocity();
		lv.Multiply(0.95);
		wBall.SetLinearVelocity(lv);
		
		let keyAxis = [0, 0];
		if (Keys.left) keyAxis[0] = -1;
		else if (Keys.right) keyAxis[0] = 1;
		if (Keys.down) keyAxis[1] = -1;
		else if (Keys.up) keyAxis[1] = 1;

		// Apply user-directed force.
		var f = new b2Vec2(keyAxis[0]*wBall.GetMass()*0.25, keyAxis[1]*wBall.GetMass()*0.25);
		wBall.ApplyImpulse(f, wBall.GetPosition());          
		// keyAxis = [0, 0];

		// Take a time step.
		wWorld.Step(1/60, 8, 3);
	},
	updateRenderWorld() {
		// Update ball position.
		var stepX = wBall.GetPosition().x - ballMesh.position.x;
		var stepY = wBall.GetPosition().y - ballMesh.position.y;
		ballMesh.position.x += stepX;
		ballMesh.position.y += stepY;

		// Update ball rotation.
		var tempMat = new THREE.Matrix4();
		tempMat.makeRotationAxis(new THREE.Vector3(0,1,0), stepX/ballRadius);
		tempMat.multiplySelf(ballMesh.matrix);
		ballMesh.matrix = tempMat;
		tempMat = new THREE.Matrix4();
		tempMat.makeRotationAxis(new THREE.Vector3(1,0,0), -stepY/ballRadius);
		tempMat.multiplySelf(ballMesh.matrix);
		ballMesh.matrix = tempMat;
		ballMesh.rotation.getRotationFromMatrix(ballMesh.matrix);
		
		// Update camera and light positions.
		camera.position.x += (ballMesh.position.x - camera.position.x) * 0.1;
		camera.position.y += (ballMesh.position.y - camera.position.y) * 0.1;
		camera.position.z += (5 - camera.position.z) * 0.1;
		light.position.x = camera.position.x;
		light.position.y = camera.position.y;
		light.position.z = camera.position.z - 3.7;
	},
	checkForVictory() {
		// Check for victory.
		var mazeX = Math.floor(ballMesh.position.x + 0.5);
		var mazeY = Math.floor(ballMesh.position.y + 0.5);
		if (mazeX == mazeDimension && mazeY == mazeDimension - 2) { 
			mazeDimension += 2;
			astray.dispatch({ type: "level-solved" });
		}
	}
};

window.exports = astray;
