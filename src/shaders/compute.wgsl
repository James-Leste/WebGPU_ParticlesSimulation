
// particle position array
@binding(0) @group(0) var<storage, read_write> position: array<f32>;
// particle velocity array
@binding(1) @group(0) var<storage, read_write> velocity: array<f32>;
// mouse axis vector (x, y)
@binding(2) @group(0) var<storage, read_write> mouse_axis: vec2<f32>;


@compute @workgroup_size(64)
// global_id: current index in arrays
fn main(@builtin(global_invocation_id) global_id : vec3<u32>) {
    let i = global_id.x;
    let gravity = 0.001;
    let speedthershold = 0.0001;
    let mouseInfluenceRadius = 0.2; // Adjust this value as needed
    let mouseInfluenceFactor = 0.1; // Adjust this value as needed
    // Define the angle of the "V" lines from the vertical (in radians)
    

    if (i >= arrayLength(&position)) {
        return;
    }

    velocity[i * 2] += -sign(velocity[i * 2]) * gravity;
    velocity[i * 2 + 1] += -sign(velocity[i * 2 + 1]) * gravity;
    // Simple motion update
    position[i * 2] += velocity[i * 2];
    position[i * 2 + 1] += velocity[i * 2 + 1];

    // Boundary checks
    // if (abs(position[i * 2]) > 1.0 ||    (    abs(position[i * 2]) < 0.5 && abs(position[i * 2 + 1])  < 0.5    )  ){
    //     velocity[i * 2] *= -1.0;
    //     //position[i].x = sign(position[i].x);
    // }
    // if (abs(position[i * 2 + 1]) > 1.0 || (    abs(position[i * 2 + 1]) < 0.5 && abs(position[i * 2])  < 0.5    )  ) {
    //     velocity[i * 2 + 1] *= -1.0;
    //     //position[i].y = sign(position[i].y);
    // }

    if (abs(position[i * 2]) > 1.0){
        velocity[i * 2] *= -1.0;
        //position[i].x = sign(position[i].x);
    }
    if (abs(position[i * 2 + 1]) > 1.0) {
        velocity[i * 2 + 1] *= -1.0;
        //position[i].y = sign(position[i].y);
    }


    let dx = (mouse_axis.x-400)/400 - position[i * 2];
    let dy = -(mouse_axis.y-400)/400 - position[i * 2 + 1];
    let distanceToMouse = sqrt(dx * dx + dy * dy);

    if (distanceToMouse < mouseInfluenceRadius) {
            velocity[i * 2] += dx * mouseInfluenceFactor;
            velocity[i * 2 + 1] += dy * mouseInfluenceFactor;
    }
}