import { Environment } from "@react-three/drei";

export const Lights = () => (
	<>
		<ambientLight />
		<pointLight position={[10, 10, 10]} />
		<Environment preset="sunset" />
	</>
);
