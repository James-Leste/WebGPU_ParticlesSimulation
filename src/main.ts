// This function initializes WebGPU and sets up the particle system.
import particles from "./shaders/particles.wgsl"
import compute from "./shaders/compute.wgsl"
const x_axis : HTMLElement = <HTMLElement>document.getElementById("x-axis");
const y_axis : HTMLElement = <HTMLElement>document.getElementById("y-axis");
const x_text : HTMLElement = <HTMLElement>document.getElementById("x-text");
const y_text : HTMLElement = <HTMLElement>document.getElementById("y-text");
const processor : HTMLElement = <HTMLElement>document.getElementById("processor");
const framerate : HTMLElement = <HTMLElement>document.getElementById("framerate");
const hardwareElement : HTMLElement = <HTMLElement>document.getElementById("hardware-select");
let posX : number;
let posY : number;
let mouseData = new Float32Array(2);

let lastFrameTime = 0;
let frameCount = 0;
let elapsed = 0;
let fps = 0;

let hardwareChoice : string = "gpu";

const centralRegionSize = 0.5;

//get mouse movement
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

const Initialize = async() => {
    if (!navigator.gpu) {
        throw Error('WebGPU not supported.');
    }

    // Get GPU adapter and device
    const canvas: HTMLCanvasElement = <HTMLCanvasElement>document.getElementById("webgpu"); 

    const adapter : GPUAdapter = <GPUAdapter> await navigator.gpu.requestAdapter();
    const device : GPUDevice = <GPUDevice> await adapter.requestDevice();

    // 记录鼠标位置
    canvas.addEventListener('mousemove', function(event) {
        const mousePos = getMousePos(canvas, event);
        posX = mousePos.x;
        posY = mousePos.y;
        mouseData = new Float32Array([posX, posY]);
        // Do something with posX and posY
        x_axis.innerText = "X: " + (mouseData[0]-250)/250;
        y_axis.innerText = "Y: " + (mouseData[1]-250)/250;
        device.queue.writeBuffer(
            mouseBuffer,
            0,
            mouseData.buffer,
            mouseData.byteOffset,
            mouseData.byteLength
        );
    });

    const context : GPUCanvasContext = <GPUCanvasContext> canvas.getContext("webgpu");

    // Configure the context
    const format = "bgra8unorm";
    context.configure({
        device: device,
        format: format
    });

    const shaderModule = device.createShaderModule({ code: particles });

    const computeModule = device.createShaderModule({code: compute});

    // Create buffers for particles
    // Initial positions and velocities for the particles
    let numParticles = 10000;
    let particlePositions = new Float32Array(numParticles * 2); // x, y for each particle
    let particleVelocities = new Float32Array(numParticles * 2); // vx, vy for each particle
    

    for (let i = 0; i < numParticles; i++) {
        let x, y;
        do {
            x = (Math.random() * 2 - 1) * canvas.width / canvas.height; // x
            y = (Math.random() * 2 - 1); // y
        } while (Math.abs(x) < centralRegionSize && Math.abs(y) < centralRegionSize); // Check if the particle is within the central region
        
        particlePositions[i * 2] = x; // x
        particlePositions[i * 2 + 1] = y; // y
        

        particleVelocities[i * 2] = (Math.random() - 0.5) * 0.002; // vx
        particleVelocities[i * 2 + 1] = (Math.random() - 0.5) * 0.002; // vy

        // particleVelocities[i * 2] = 0; // vx
        // particleVelocities[i * 2 + 1] = 0; // vy
    }

    // Create GPU buffers
    const particleBuffer = device.createBuffer({
        size: particlePositions.byteLength,
        usage: GPUBufferUsage.STORAGE | GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
        mappedAtCreation: true,
    });

    const velocityBuffer = device.createBuffer({
        size: particleVelocities.byteLength,
        usage: GPUBufferUsage.STORAGE | GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
        mappedAtCreation: true,
    });

    const mouseBuffer = device.createBuffer({
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
    new Float32Array(particleBuffer.getMappedRange()).set(particlePositions);
    particleBuffer.unmap();

    new Float32Array(velocityBuffer.getMappedRange()).set(particleVelocities);
    velocityBuffer.unmap();
    
    new Float32Array(mouseBuffer.getMappedRange()).set(mouseData);
    mouseBuffer.unmap();
    

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

    const computePipelineLayout : GPUPipelineLayout = device.createPipelineLayout({bindGroupLayouts:[bindGroupLayout]});
    const computePipeline : GPUComputePipeline = <GPUComputePipeline> device.createComputePipeline({
        layout : computePipelineLayout,
        compute: {
            module: computeModule,
            entryPoint: 'main'
        }
    })


    // Create pipeline and bind group
    const renderPipelineLayout = device.createPipelineLayout({ bindGroupLayouts: [] });
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
        const gravity = 0.0001;
        const speedthershold = 0.0001
        const mouseInfluenceRadius = 0.2; // Adjust this value as needed
        const mouseInfluenceFactor = 0.1; // Adjust this value as needed

        for (let i = 0; i < numParticles; i++) {
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

    async function updateParticlesGPU() {
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
