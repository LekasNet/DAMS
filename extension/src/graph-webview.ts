import ForceGraph3D from '3d-force-graph';

declare function acquireVsCodeApi(): { postMessage(message:unknown):void };
type Node={id:string;label:string;error?:boolean};
const vscode=acquireVsCodeApi();
const root=document.getElementById('graph')!;
const graph=new ForceGraph3D(root)
 .backgroundColor('#1e1e1e')
 .nodeId('id')
 .nodeLabel((node:object)=>`<b>${(node as Node).label}</b>`)
 .nodeColor((node:object)=>(node as Node).error?'#f14c4c':'#4ec9b0')
 .nodeRelSize(5)
 .linkColor(()=> '#6a9955')
 .linkDirectionalArrowLength(3.5)
 .linkDirectionalArrowRelPos(1)
 .onNodeClick((node:object)=>vscode.postMessage({type:'open',id:(node as Node).id}));
window.addEventListener('message',event=>{const message=event.data;if(message.type==='graph')graph.graphData(message.data);});
window.addEventListener('resize',()=>graph.width(root.clientWidth).height(root.clientHeight));
