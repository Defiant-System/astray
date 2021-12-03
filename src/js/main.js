
const { Maze, Box2D, THREE } = await window.fetch("~/js/bundle.js");


const scene = new THREE.Scene();
const ratio = window.innerWidth / window.innerHeight;
const camera = new THREE.PerspectiveCamera(60, ratio, 0.1, 1000 );
const renderer = new THREE.WebGLRenderer({ antialias: true });

renderer.setSize(window.innerWidth, window.innerHeight);
camera.position.set(1, 1, 5);

const ambientLight = new THREE.AmbientLight(0xffffff, 0.1);
scene.add(ambientLight);

const pointLight = new THREE.PointLight(0xffffff, 1);
pointLight.position.set(1, 1, 1.3);
scene.add(pointLight);




let loader = new THREE.TextureLoader(),
	textures = {
		brick: { path: "~/img/brick.png" },
		plane: { path: "~/img/concrete.png" },
		ball:  { path: "~/img/ball.png" },
	},
	keyAxis = [0, 0],
	ballMesh,
	ballRadius = 0.25,
	mazeDimension = 11,
	mazeMesh,
	maze,
	// Box2D shortcuts
	b2World        = Box2D.Dynamics.b2World,
	b2FixtureDef   = Box2D.Dynamics.b2FixtureDef,
	b2BodyDef      = Box2D.Dynamics.b2BodyDef,
	b2Body		   = Box2D.Dynamics.b2Body,
	b2CircleShape  = Box2D.Collision.Shapes.b2CircleShape,
	b2PolygonShape = Box2D.Collision.Shapes.b2PolygonShape,
	b2Settings     = Box2D.Common.b2Settings,
	b2Vec2         = Box2D.Common.Math.b2Vec2,
	wWorld,
	wBall;

var bounciness = 0.9;
var gravity = 0.2;
var velocityX = 1; //Math.cos(angleRad) * power;
var velocityY = 1; //Math.sin(angleRad) * power;
var velocityZ = 1;
var ballCircumference = Math.PI * ballRadius * 2;
var ballVelocity = new THREE.Vector3();
var ballRotationAxis = new THREE.Vector3();


const astray = {
	init() {
		// fast references
		this.content = window.find("content");
		// add renderer canvas to window body
		this.content.append(renderer.domElement);

		Promise.all(Object.keys(textures).map(key => {
			textures[key].map = loader.load(textures[key].path);
		}))
		.then(loadedTextures => {
			this.dispatch({ type: "init-level" });
		});
	},
	dispatch(event) {
		let Self = astray,
			el;
		switch (event.type) {
			// system events
			case "window.open":
				break;
			case "window.keystroke":
				switch (event.keyCode) {
					case 37: keyAxis = [-1, 0]; break;  // left
					case 39: keyAxis = [1,  0]; break;  // right
					case 38: keyAxis = [0,  1]; break;  // up
					case 40: keyAxis = [0, -1]; break;  // down
				}
				break;
			case "open-help":
				defiant.shell("fs -u '~/help/index.md'");
				break;
			// custom events
			case "init-level":
				maze = Maze.generate(mazeDimension);
				maze[mazeDimension-1][mazeDimension-2] = false;

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
	createRenderWorld() {
		// Add the maze
		mazeMesh = this.generateMazeMesh(maze);
		scene.add(mazeMesh);

		// Add ball
		let ballGeo = new THREE.SphereGeometry(ballRadius, 32, 16);
		let ballMat = new THREE.MeshStandardMaterial({ map: textures.ball.map });
		ballMesh = new THREE.Mesh(ballGeo, ballMat);
		ballMesh.position.set(1, 1, ballRadius);
		scene.add(ballMesh);

		// Add the ground
		let planeGeo = new THREE.PlaneGeometry(mazeDimension + 2, mazeDimension + 2, mazeDimension, mazeDimension);
		let planeMat = new THREE.MeshStandardMaterial({ color: 0x555555 });
		let planeMesh = new THREE.Mesh (planeGeo, planeMat);
		planeMesh.position.set((mazeDimension-1)/2, (mazeDimension-1)/2, 0);
		scene.add(planeMesh);
	},
	generateMazeMesh(field) {
		let totalGeom = new THREE.Geometry(),
			material = new THREE.MeshPhongMaterial({ map: textures.brick.map });
		for (let i=0; i<field.dimension; i++) {
			for (let j=0; j<field.dimension; j++) {
				if (field[i][j]) {
					let cubeGeo = new THREE.BoxGeometry(1,1,1,1,1,1),
						cubeMesh = new THREE.Mesh(cubeGeo);
					cubeMesh.position.x = i;
					cubeMesh.position.y = j;
					cubeMesh.position.z = 0.35;
					cubeMesh.updateMatrix();cubeGeo
					totalGeom.merge(cubeGeo, cubeMesh.matrix);
				}
			}
		}
		return new THREE.Mesh(totalGeom, material);
	},
	updatePhysicsWorld() {
		// Apply "friction". 
		var velocity = wBall.GetLinearVelocity();
		velocity.Multiply(0.95);
		wBall.SetLinearVelocity(velocity);
		
		// Apply user-directed force.
		var force = new b2Vec2(keyAxis[0] * wBall.GetMass() * 0.95, keyAxis[1] * wBall.GetMass() * 0.95);
		wBall.ApplyImpulse(force, wBall.GetPosition());
		keyAxis = [0, 0];

		// Take a time step.
		wWorld.Step(1/60, 8, 3);
	},
	updateRenderWorld() {
		// Update ball position.
		var stepX = wBall.GetPosition().x - ballMesh.position.x;
		var stepY = wBall.GetPosition().y - ballMesh.position.y;

		ballMesh.position.x += stepX;
		ballMesh.position.y += stepY;
		ballMesh.position.z += velocityZ;

		if (ballMesh.position.z < ballRadius) {
			velocityZ *= -bounciness;
			ballMesh.position.z = ballRadius;
		}

		ballVelocity.set(stepX, stepY, velocityZ);
		ballRotationAxis.set(0, 0, ballRadius).cross(ballVelocity).normalize();

		let velocityMag = ballVelocity.length();
		let rotationAmount = velocityMag * (Math.PI * 2) / ballCircumference;
		ballMesh.rotateOnWorldAxis(ballRotationAxis, rotationAmount);
		
		velocityZ -= gravity;

		// Update camera and light positions.
		camera.position.x += (ballMesh.position.x - camera.position.x) * 0.1;
		camera.position.y += (ballMesh.position.y - camera.position.y) * 0.1;
		camera.position.z += (5 - camera.position.z) * 0.1;
		pointLight.position.x = camera.position.x;
		pointLight.position.y = camera.position.y;
		pointLight.position.z = camera.position.z - 3.7;
	},
	animate() {
		let Self = astray;

		Self.updatePhysicsWorld();
		Self.updateRenderWorld();

		renderer.render(scene, camera);

		requestAnimationFrame(astray.animate);
	}
};

window.exports = astray;
