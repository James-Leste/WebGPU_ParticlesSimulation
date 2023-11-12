// import './style.css'
// import { setupCounter } from './counter'
import shader from "./shaders/shaders.wgsl";

function getMousePos(canvas : HTMLCanvasElement, event : MouseEvent) {
    const rect = canvas.getBoundingClientRect();
    return {
        x: event.clientX - rect.left,
        y: event.clientY - rect.top
    };
}

const Initialize = async() => {
    if (!navigator.gpu) {
        throw Error('WebGPU not supported.');
    }

    
    
    const canvas: HTMLCanvasElement = <HTMLCanvasElement>document.getElementById("webgpu"); 

    const adapter : GPUAdapter = <GPUAdapter> await navigator.gpu.requestAdapter();
    const device : GPUDevice = <GPUDevice> await adapter.requestDevice();

    console.log(adapter);
    console.log(device);

    const context : GPUCanvasContext = <GPUCanvasContext> canvas.getContext("webgpu");
    const format : GPUTextureFormat = "bgra8unorm";

    context.configure({
        device: device,
        format: format,
        alphaMode: "opaque"
    });

    // 设置bindgroup的分布, 作为bindgroup的参数
    const bindGroupLayout : GPUBindGroupLayout = device.createBindGroupLayout({
        entries: [],
    });


    //设置bindgroup, 作为Renderpipeline的参数
    const bindGroup : GPUBindGroup = device.createBindGroup({
        layout: bindGroupLayout,
        entries: []
    });
    
    //设置pipelinelayout， 作为pipeline的参数
    // const pipelineLayout : GPUPipelineLayout = device.createPipelineLayout({
    //     bindGroupLayouts: [bindGroupLayout]
    // });
    const renderPipelineDescriptor : GPURenderPipelineDescriptor = {
        vertex : {
            module : device.createShaderModule({
                code : shader
            }),
            entryPoint : "vtx_main"
        },

        fragment : {
            module : device.createShaderModule({
                code : shader
            }),
            entryPoint : "frag_main",
            targets : [{
                format : format
            }]
        },

        primitive : {
            topology : "triangle-list"
        },

        layout: "auto"
    }
    
    const bindGroupLayoutCompute = device.createBindGroupLayout({
        entries: [
        {
            binding: 0,
            visibility: GPUShaderStage.COMPUTE,
            buffer: {
            type: 'read-only-storage',
            },
        },
        {
            binding: 1,
            visibility: GPUShaderStage.COMPUTE,
            buffer: {
            type: 'read-only-storage',
            },
        },
        {
            binding: 2,
            visibility: GPUShaderStage.COMPUTE,
            buffer: {
            type: 'storage',
            },
        },
        ],
    });

    const renderPipeline : GPURenderPipeline = device.createRenderPipeline(renderPipelineDescriptor);

    //command encoder: records draw commands for submission
    //从device 获取GPUCommandEncoder
    //用于encode发送给GPU的命令
    const commandEncoder : GPUCommandEncoder = device.createCommandEncoder();
    //texture view: image view to the color buffer in this case
    //从context获取texture
    const textureView : GPUTextureView = context.getCurrentTexture().createView();
    //renderpass: holds draw commands, allocated from command encoder
    //beginRenderPass返回一个GPURenderPassEncoder用于控制rendering
    
    const renderPassDescriptor : GPURenderPassDescriptor= {colorAttachments: [{
        view: textureView,
        clearValue: {r: 0.0 , g: 0.0, b: 0.0, a: 1.0},
        loadOp: "clear",
        storeOp: "store"
    }]}

    const renderpass : GPURenderPassEncoder = commandEncoder.beginRenderPass(renderPassDescriptor);
    renderpass.setPipeline(renderPipeline);
    renderpass.setBindGroup(0, bindGroup);
    renderpass.draw(3, 1, 0, 0);
    renderpass.end();

    device.queue.submit([commandEncoder.finish()]);

    const x_axis : HTMLHeadElement = <HTMLHeadElement> document.getElementById("x-axis");
    const y_axis : HTMLHeadElement = <HTMLHeadElement> document.getElementById("y-axis");

    canvas.addEventListener('mousemove', function(event) {
        const mousePos = getMousePos(canvas, event);
        const posX = mousePos.x;
        const posY = mousePos.y;
    
        // Do something with posX and posY
        x_axis.innerText = "X: " + posX;
        y_axis.innerText = "Y: " + posY;
    });
    
}


Initialize();

