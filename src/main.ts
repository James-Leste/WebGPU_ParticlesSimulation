// This function initializes WebGPU and sets up the particle system.
import particles from "./shaders/particles.wgsl"
import compute from "./shaders/compute.wgsl"
import { send } from "process";
// HTML element for presenting X, Y axis value of mouse
const x_axis : HTMLElement = <HTMLElement>document.getElementById("x-axis");
const y_axis : HTMLElement = <HTMLElement>document.getElementById("y-axis");
// Not used
//const x_text : HTMLElement = <HTMLElement>document.getElementById("x-text");
//const y_text : HTMLElement = <HTMLElement>document.getElementById("y-text");

// Processor label
const processor : HTMLElement = <HTMLElement>document.getElementById("processor");
// frame rate label
const framerate : HTMLElement = <HTMLElement>document.getElementById("framerate");
// hardware selection bar
const hardwareElement : HTMLElement = <HTMLElement>document.getElementById("hardware-select");
//const particleNumELement : HTMLInputElement = <HTMLInputElement> document.getElementById("slider");
//const particleNumStringElement : HTMLElement = <HTMLElement> document.getElementById("sliderValue");
let posX : number;
let posY : number;
let mouseData = new Float32Array(2);

// data for calculating framerate
let lastFrameTime = 0;
let frameCount = 0;
let elapsed = 0;
let fps = 0;

let hardwareChoice : string = "gpu";

const centralRegionSize = 0.5;

//get mouse position as X, Y axis value
function getMousePos(canvas: HTMLCanvasElement, event: any) {
    const rect = canvas.getBoundingClientRect();
    return {
        x: event.clientX - rect.left,
        y: event.clientY - rect.top
    };
}

hardwareElement.addEventListener('change', (event) => {
    // 获取选择的值
    hardwareChoice = (event.target as HTMLSelectElement).value;
    console.log(hardwareChoice);
});

// particleNumELement.addEventListener("input", (event : any) => {
//     particleNumStringElement.textContent = <string> event.target.value;
//     numParticles = <number> event.target.value;
// });


// Initialize gpu
const Initialize = async() => {
    if (!navigator.gpu) {
        throw Error('WebGPU not supported.');
    }

    // Get GPU adapter and device
    const canvas: HTMLCanvasElement = <HTMLCanvasElement>document.getElementById("webgpu"); 

    const adapter : GPUAdapter = <GPUAdapter> await navigator.gpu.requestAdapter();
    const device : GPUDevice = <GPUDevice> await adapter.requestDevice();

    // 记录鼠标位置 record mouse position
    canvas.addEventListener('mousemove', function(event) {
        const mousePos = getMousePos(canvas, event);
        posX = mousePos.x;
        posY = mousePos.y;
        mouseData = new Float32Array([posX, posY]);
        // Do something with posX and posY
        x_axis.innerText = "X: " + mouseData[0]/800;
        y_axis.innerText = "Y: " + mouseData[1]/800;

        // send mouse position data to the buffer
        device.queue.writeBuffer(
            mouseBuffer,
            0, // bufferOffset (starting point)
            mouseData.buffer,
            mouseData.byteOffset, // dataOffset
            mouseData.byteLength
        );
    });

    // get context via <canvas> element
    const context : GPUCanvasContext = <GPUCanvasContext> canvas.getContext("webgpu");

    // Configure the context
    // recommended
    const format = navigator.gpu.getPreferredCanvasFormat();
    context.configure({
        device: device,
        format: format
    });

    const shaderModule = device.createShaderModule({ code: particles });

    const computeModule = device.createShaderModule({code: compute});

    // Create buffers for particles
    // Initial positions and velocities for the particles
    let numParticles = 1000000;
    // [x_1, y_1, x_2, y_2 .... x_n, y_n]
    let particlePositions = new Float32Array(numParticles * 2); // x, y for each particle
    // [v_x_1, v_y_1, v_x_2, v_y_2 .... v_x_n, v_y_n]
    let particleVelocities = new Float32Array(numParticles * 2); // v_x, v_y for each particle
    
    //Set all initial locations for all particles(Randomized in this case)
    for (let i = 0; i < numParticles; i++) {
        let x, y;
        //Add a central square in the canvas
        // do {
        //     x = (Math.random() * 2 - 1) * canvas.width / canvas.height; // x
        //     y = (Math.random() * 2 - 1); // y
        // } while (Math.abs(x) < centralRegionSize && Math.abs(y) < centralRegionSize); // Check if the particle is within the central region
        
        x = (Math.random() * 2 - 1) //x
        y = (Math.random() * 2 - 1); // y
        particlePositions[i * 2] = x; // x
        particlePositions[i * 2 + 1] = y; // y
        

        particleVelocities[i * 2] = (Math.random() - 0.5) * 0.002; // vx
        particleVelocities[i * 2 + 1] = (Math.random() - 0.5) * 0.002; // vy

        // particleVelocities[i * 2] = 0; // vx
        // particleVelocities[i * 2 + 1] = 0; // vy
    }

    // Create GPU buffers
    // Buffer for particles location array
    
    const particleBuffer = device.createBuffer({
        label: "particleBuffer",
        size: particlePositions.byteLength,
        usage: GPUBufferUsage.STORAGE | GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
        mappedAtCreation: true, // Make the buffer "mapped" at creation
    });

    // Buffer for particle velocity array
    const velocityBuffer = device.createBuffer({
        label: "velocityBuffer",
        size: particleVelocities.byteLength,
        usage: GPUBufferUsage.STORAGE | GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
        mappedAtCreation: true,
    });

    // Buffer for mouse location array
    const mouseBuffer = device.createBuffer({
        label: "mouseLocationBuffer",
        size: 2 * Float32Array.BYTES_PER_ELEMENT,
        usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
        mappedAtCreation: true,
    });

    // const particlePositionBuffer = device.createBuffer({
    //     size: particlePositions.byteLength,
    //     usage: GPUBufferUsage.Math,
    //     mappedAtCreation: true,
    // })

    // const particleVelocitiesBuffer = device.createBuffer({
    //     size: particleVelocities.byteLength,
    //     usage: GPUBufferUsage.Math,
    //     mappedAtCreation: true
    // })

    // const mousePositionBuffer = device.createBuffer({
    //     size: particleVelocities.byteLength,
    //     usage: GPUBufferUsage.Math,
    //     mappedAtCreation: true
    // });


    /* write data into buffer */

    // GPUBuffer.mapState will print the mapping state of a Buffer
    // mapped means the data in buffer can be accessed by JS 
    // unmapped means the data can be used by GPU, can't be changed by JS

    // mapped -> unmapped GPUBuffer.unmap()
    // unmapped -> mapped GPUBuffer.Async()
    new Float32Array(particleBuffer.getMappedRange()).set(particlePositions);
    console.log(particleBuffer.mapState)
    particleBuffer.unmap();
    console.log(particleBuffer.mapState)

    new Float32Array(velocityBuffer.getMappedRange()).set(particleVelocities);
    velocityBuffer.unmap();
    
    new Float32Array(mouseBuffer.getMappedRange()).set(mouseData);
    mouseBuffer.unmap();
    
    // GPUbindGroupLayout is a template for GPUbindGroup

    // It defines the structure and purpose of related GPU resources such as 
    // buffers that will be used in a pipeline
    const bindGroupLayout = device.createBindGroupLayout({
        entries: [
            {
                binding: 0,
                visibility: GPUShaderStage.COMPUTE,
                buffer: {
                    type: 'storage',
                    minBindingSize: particlePositions.byteLength,
                }   
            }, 
            {
                binding: 1, 
                visibility: GPUShaderStage.COMPUTE,
                buffer: {
                    type: 'storage',
                    minBindingSize: particleVelocities.byteLength,
                }  
            }, 
            {
                binding: 2, 
                visibility: GPUShaderStage.COMPUTE,
                buffer: {
                    type: 'storage',
                    minBindingSize: 2 * Float32Array.BYTES_PER_ELEMENT
                }  
            }]
    });

    // GPUPipelineLayout defines how GPUbindGroupLayout be used by pipelines
    // use GPUbindGroupLayout as template
    const computePipelineLayout : GPUPipelineLayout = device.createPipelineLayout({bindGroupLayouts:[bindGroupLayout]});
    // GPUComputePipeline controls compute shader module
    const computePipeline : GPUComputePipeline = <GPUComputePipeline> device.createComputePipeline({
        layout : computePipelineLayout,
        compute: {
            module: computeModule,
            entryPoint: 'main'
        }
    })

    const renderPipelineLayout = device.createPipelineLayout({ bindGroupLayouts: [] });
    // GPUrenderPipeline controls vertex shader and fragment shader modules
    const renderPipeline : GPURenderPipeline = <GPURenderPipeline> device.createRenderPipeline({
        layout: renderPipelineLayout,
        vertex: {
            module: shaderModule,
            entryPoint: 'vertex_main',
            buffers: [{
                arrayStride: 2 * particlePositions.BYTES_PER_ELEMENT,
                attributes: [{
                    shaderLocation: 0,
                    offset: 0,
                    format: 'float32x2'
                }],
            }],
        },
        fragment: {
            module: shaderModule,
            entryPoint: 'fragment_main',
            targets: [{ format: format }],
        },
        primitive: {
            topology: 'point-list',
        },
    });

    const particleBindGroup : GPUBindGroup = <GPUBindGroup> device.createBindGroup({
        layout: bindGroupLayout,
        entries: [
            {
                binding: 0,
                resource: {
                    buffer: particleBuffer
                }
            },
            {
                binding: 1,
                resource: {
                    buffer: velocityBuffer
                }
            },
            {
                binding: 2,
                resource: {
                    buffer: mouseBuffer
                }
            }]
    });


    // const computePipeline = device.createComputePipeline({
    //     layout: pipelineLayout,
    //     compute: {
    //         module: device.createShaderModule({ code: computeShaderCode }),
    //         entryPoint: 'compute_main',
    //     },
    // });


    // Animation loop
    function updateParticlesCPU() {
        processor.innerText = "Computed with CPU";
        const boundary = 1;
        const gravity = 0.001;
        //const speedthershold = 0.0001
        const mouseInfluenceRadius = 0.2; // Adjust this value as needed
        const mouseInfluenceFactor = 0.1; // Adjust this value as needed

        for (let i = 0; i < numParticles; i++) {
            //particleVelocities[i * 2 + 1] -= gravity;
            particleVelocities[i * 2] += -Math.sign(particleVelocities[i * 2]) * gravity;
            particleVelocities[i * 2 + 1] += -Math.sign(particleVelocities[i * 2 + 1]) * gravity;
            particlePositions[i * 2] += particleVelocities[i * 2]; // Update x position
            particlePositions[i * 2 + 1] += particleVelocities[i * 2 + 1]; // Update y position
            if (Math.abs(particlePositions[i * 2]) > boundary){
                particleVelocities[i * 2] *= -1;
                //particlePositions[i * 2] = Math.sign(particlePositions[i*2]) * boundary;
            } 
            
            if (Math.abs(particlePositions[i * 2 + 1]) > boundary){
                particleVelocities[i * 2 + 1] *= -1;
                // if (i == 0){
                //     console.log("hit");
                // }
                //particlePositions[i * 2 + 1] = Math.sign(particlePositions[ i * 2 + 1]) * boundary;
            } 

            let dx = (posX-400)/400 - particlePositions[i * 2];
            let dy = -(posY-400)/400 - particlePositions[i * 2 + 1];
            let distanceToMouse = Math.sqrt(dx * dx + dy * dy);

            if (distanceToMouse < mouseInfluenceRadius) {
                particleVelocities[i * 2] += dx * mouseInfluenceFactor;
                particleVelocities[i * 2 + 1] += dy * mouseInfluenceFactor;
            }
            // if (particlePositions[i * 2] > ((posX-250)/250 - 0.01)){
            //     particleVelocities[i * 2] += 0.003;
            //     particleVelocities[i * 2 + 1] += 0.003;
            // }
        }

        // Copy the updated positions back to the GPU buffer
        device.queue.writeBuffer(
            particleBuffer,
            0,
            particlePositions.buffer,
            particlePositions.byteOffset,
            particlePositions.byteLength
        );
        
    }

    function updateParticlesGPU() {
        processor.innerText = "Computed with GPU";
        const commandEncoder = device.createCommandEncoder();
        const passEncoder = commandEncoder.beginComputePass();
        passEncoder.setPipeline(computePipeline);
        passEncoder.setBindGroup(0, particleBindGroup);
        passEncoder.dispatchWorkgroups(Math.ceil(numParticles / 64), 1, 1);
        passEncoder.end();
        device.queue.submit([commandEncoder.finish()]);
    }

    function render(now:number) {
        now *= 0.001;  // Convert the time to seconds
        const deltaTime = now - lastFrameTime;
        lastFrameTime = now;

        // Accumulate time and count frames over a second
        elapsed += deltaTime;
        frameCount++;
        if (elapsed >= 1.0) { // Update FPS every second
            fps = frameCount / elapsed;
            frameCount = 0;
            elapsed = 0;
        
            // Update the FPS display
            framerate.innerText = `FPS: ${fps.toFixed(2)}`;
        }
        if(hardwareChoice === "cpu"){
            updateParticlesCPU();
        }
        else {
            updateParticlesGPU();
        }
        
        //const start = performance.now();
        
        const commandEncoder = device.createCommandEncoder();
        const textureView : GPUTextureView = context.getCurrentTexture().createView();
        const renderPassDescriptor : GPURenderPassDescriptor = {
            colorAttachments: [{
                view: textureView,
                loadOp: 'clear',
                clearValue: { r: 0.0, g: 0.0, b: 0.0, a: 1.0 },
                storeOp: 'store',
            }],
        };
        //numParticles += 100;
        const passEncoder = commandEncoder.beginRenderPass(renderPassDescriptor);
        passEncoder.setPipeline(renderPipeline);
        passEncoder.setVertexBuffer(0, particleBuffer);
        passEncoder.draw(numParticles);
        passEncoder.end();

        device.queue.submit([commandEncoder.finish()]);

        requestAnimationFrame(render);
    }

    requestAnimationFrame(render);
}

window.onload = Initialize;
