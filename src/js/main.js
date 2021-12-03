
const { Maze, Box2D, THREE } = await window.fetch("~/js/bundle.js");


const scene = new THREE.Scene();
const ratio = window.innerWidth / window.innerHeight;
const camera = new THREE.PerspectiveCamera(60, ratio, 0.1, 1000 );
const renderer = new THREE.WebGLRenderer({ antialias: true });

renderer.setSize(window.innerWidth, window.innerHeight);
camera.position.set(1, 1, 5);

// const ambientLight = new THREE.AmbientLight(0xffffff, 0.15);
// scene.add(ambientLight);

const pointLight = new THREE.PointLight(0xffffff, 1);
pointLight.position.set(1, 1, 1.3);
scene.add(pointLight);




let loader = new THREE.TextureLoader(),
	textures = {
		brick: { path: "~/img/brick.png" },
		plane: { path: "~/img/concrete.png" },
		ball:  { path: "~/img/ball.png" },
	},
	ballMesh,
	ballRadius = 0.25,
	mazeDimension = 11,
	mazeMesh,
	maze;



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
				break;
			case "open-help":
				defiant.shell("fs -u '~/help/index.md'");
				break;
			// custom events
			case "init-level":
				maze = Maze.generate(mazeDimension);
				maze[mazeDimension-1][mazeDimension-2] = false;

				// Add the maze
				mazeMesh = Self.generateMazeMesh(maze);
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

				// start loop
				Self.animate();
				break;
		}
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
	animate() {
		requestAnimationFrame(astray.animate);
		// cube.rotation.x += 0.04;
		// cube.rotation.y += 0.04;
		renderer.render(scene, camera);
	}
};

window.exports = astray;
