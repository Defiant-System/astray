
const { Maze, Box2D, THREE } = await window.fetch("~/js/bundle.js");

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

let ironTexture   = THREE.ImageUtils.loadTexture("~/img/ball.png"),
	planeTexture  = THREE.ImageUtils.loadTexture("~/img/concrete.png"),
	brickTexture  = THREE.ImageUtils.loadTexture("~/img/brick.png"),
	gameState     = undefined,
	light         = undefined,
	mouseX        = undefined, 
	mouseY        = undefined,
	maze          = undefined, 
	mazeMesh      = undefined,
	mazeDimension = 11,
	planeMesh     = undefined,
	ballMesh      = undefined,
	ballRadius    = 0.25,
	keyAxis       = [0, 0],
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

		this.dispatch({ type: "init-level" });
	},
	dispatch(event) {
		let Self = astray,
			el;
		// console.log(event);
		switch (event.type) {
			// system events
			case "window.keystroke":
				switch (event.keyCode) {
					case 37: keyAxis = [-1, 0]; break;  // left
					case 39: keyAxis = [1,  0]; break;  // right
					case 38: keyAxis = [0,  1]; break;  // up
					case 40: keyAxis = [0, -1]; break;  // down
				}
				break;
			case "window.focus":
				gameState = true;
				// resume loop
				Self.animate();
				break;
			case "window.blur":
				gameState = false;
				break;
			case "open-help":
				karaqu.shell("fs -u '~/help/index.md'");
				break;
			// custom events
			case "init-level":
				maze = Maze.generate(mazeDimension);
				maze[mazeDimension-1][mazeDimension-2] = false;

				gameState = true;

				Self.createPhysicsWorld();
				Self.createRenderWorld();

				// start loop
				Self.animate();
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
		let m = new THREE.MeshPhongMaterial({ map: ironTexture });
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
		lv.Multiply(0.975);
		wBall.SetLinearVelocity(lv);
		
		// Apply user-directed force.
		var f = new b2Vec2(keyAxis[0]*wBall.GetMass()*0.95, keyAxis[1]*wBall.GetMass()*0.95);
		wBall.ApplyImpulse(f, wBall.GetPosition());          
		keyAxis = [0,0];

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
	animate() {
		let Self = astray;
		if (!gameState) return;

		Self.updatePhysicsWorld();
		Self.updateRenderWorld();

		renderer.render(scene, camera);

		requestAnimationFrame(Self.animate);
	}
};

window.exports = astray;
