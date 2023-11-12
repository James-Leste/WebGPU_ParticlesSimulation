struct VertexOut {
    @builtin(position) position : vec4<f32>,
    @location(0) color : vec4<f32>
}
    
@vertex
fn vertex_main(@location(0) position: vec4<f32>) -> VertexOut {
    var output : VertexOut;
    output.position = position;
    // Assuming a default color value since your original code doesn't include color data
    // output.color = vec4<f32>(1.0, 1.0, 1.0, 1.0); // White color
    return output;
}

@fragment
fn fragment_main(fragData: VertexOut) -> @location(0) vec4<f32> {
    // Return red color regardless of the input color
    return vec4<f32>(0.5, 1.0, 1.0, 1.0); // white color
}