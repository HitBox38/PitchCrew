/** Isolated controlled state and HTTP responses; actual UI/CSS, no agent runtime or preview data. */
export const questionInteractionFixture = `
import React,{useState,useRef,useEffect} from 'react';
import{createRoot}from'react-dom/client';
import{ChatComposerEditor}from'/src/ChatComposer/index.tsx';
import{ComposerAttachments}from'/src/ChatView/components/ComposerAttachments.tsx';
import{QuestionAnswerFields}from'/src/UserQuestions/components/QuestionAnswerFields.tsx';
import{QuestionResponseRecoveries}from'/src/UserQuestions/components/QuestionResponseRecoveries.tsx';
import{useQuestionAnswer}from'/src/UserQuestions/hooks/useQuestionAnswer.ts';
import{QuestionDockProvider}from'/src/UserQuestions/QuestionDockProvider.tsx';
import{PendingQuestions}from'/src/UserQuestions/index.tsx';
import{chatPanelPresence}from'/src/ChatView/presence.ts';
import{useQuestionSelection}from'/src/UserQuestions/hooks/useQuestionSelection.ts';
import{useQuestionLifecycle}from'/src/UserQuestions/hooks/useQuestionLifecycle.ts';
import{collapseQuestions,pendingQuestionId,emptyQuestionSelection,useQuestionState}from'/src/UserQuestions/question-state.ts';
import{useWorkspaceStore}from'/src/WorkspaceStore/index.ts';
import{ActionRefreshError}from'/src/WorkspaceStore/action-errors.ts';
import{api}from'/src/api.ts';
import{useShortcuts}from'/src/shortcuts.ts';
import{DropdownMenu,DropdownMenuTrigger,DropdownMenuContent,DropdownMenuItem}from'@pitchcrew/design-system/dropdown-menu';
import{LazyMotion,domAnimation}from'motion/react';
import '/src/styles.css';
import{useQuestionComposer}from'/src/UserQuestions/hooks/useQuestionComposer.ts';
import{useDecisionResolutionFocus}from'/src/Decisions/hooks/useDecisionResolutionFocus.ts';
import{focusAfterReveal,questionReturnFocus}from'/src/UserQuestions/focus.ts';
const h=React.createElement,question={id:'fixture-question',threadId:'fixture',roleId:'coach',messageId:'fixture-message',status:'pending',question:'Which frontend topic should we practise?',reason:'Choose a topic or write your own answer.',multiSelect:false,options:[{id:'react',label:'React rendering'},{id:'types',label:'TypeScript types'}]};
function DecisionForm(props){const form=useQuestionAnswer({...props,active:true});return h(React.Fragment,null,h('form',{id:'decision-form',className:'user-question-form',onSubmit:event=>{event.preventDefault();void form.respond();}},h(QuestionAnswerFields,{question:props.question,form})),h('button',{type:'submit',form:'decision-form',disabled:form.disabled||!form.canAnswer},'Answer and continue'),h('button',{type:'button',form:'decision-form',disabled:form.disabled,onClick:()=>void form.respond(true)},'Cancel question'));}
function Fixture(){
 const mode=new URLSearchParams(location.search).get('surface')||'chat',decision=mode!=='chat';
 const[all,setAll]=useState(decision?[question]:[]),[thread,setThread]=useState('fixture'),[draft,setDraft]=useState(''),[references,setReferences]=useState([]),[files,setFiles]=useState([]),[working,setWorking]=useState(false);
 const composer=useRef(null),input=useRef(null),decisionRoot=useRef(null),requests=useRef([]),response=useRef(null),writeCount=useRef(0),backend=useRef(decision?[question]:[]),refreshFails=useRef(false),refreshes=useRef(0),http=useRef(false),newJobs=useRef(0);
 useShortcuts({search:()=>{},newJob:()=>{newJobs.current++;}});
 const panel=chatPanelPresence.useRoot();
 const publish=next=>{backend.current=next;useWorkspaceStore.setState({data:{userInputs:next}});setAll(next);};
 useEffect(()=>{useWorkspaceStore.setState({data:{userInputs:backend.current},reload:async()=>{refreshes.current++;if(refreshFails.current)throw Error('Controlled refresh failure');publish(backend.current);}});},[]);
 useQuestionLifecycle(all);
 const questions=all.filter(item=>item.threadId===thread&&item.status==='pending'),pending=!!questions.length;
 const{activeQuestionId,setActiveQuestionId}=useQuestionSelection(thread,questions),open=!!activeQuestionId;
 const hidden=useQuestionComposer(composer,pending&&open&&!draft.trim()&&!files.length,activeQuestionId||undefined,draft,thread,files.length+references.length),decisionResolved=useDecisionResolutionFocus(decisionRoot,pending?question.id:undefined);
 const action=async(path,method,body,success,options)=>{requests.current.push({path,method,body,options});setWorking(true);try{if(http.current)return await api(path,method,body);const outcome=await new Promise((resolve,reject)=>{response.current={resolve,reject};});const id=path.split('/')[2],cancel=path.endsWith('/cancel');const next=backend.current.map(item=>item.id===id?{...item,status:cancel?'cancelled':'answered',answer:cancel?undefined:body}:item);backend.current=next;if(outcome==='accepted'){refreshFails.current=true;throw new ActionRefreshError({userInputId:id},Error('Controlled refresh failure'));}publish(next);return{userInputId:id};}finally{setWorking(false);}};
 const write=()=>{writeCount.current++;collapseQuestions(thread,questions.map(item=>item.id));focusAfterReveal(()=>input.current);};
 const resolved=(id,intent='text')=>focusAfterReveal(()=>{if(useQuestionState.getState().recoveries[id])return document.getElementById('question-response-recovery-'+id);const pending=backend.current.filter(item=>item.threadId===thread&&item.status==='pending'&&item.id!==id);const next=pendingQuestionId(pending,useQuestionState.getState().docks[thread]??emptyQuestionSelection);if(intent==='surface')return next?document.querySelector('[data-question-id="'+next+'"] .pending-question-trigger'):questionReturnFocus();return next?document.getElementById('answer-'+next):input.current;});
 useEffect(()=>{window.fixture={arrive:(multi=false)=>publish([...backend.current,{...question,multiSelect:multi}]),multiselect:()=>publish(backend.current.map(item=>({...item,multiSelect:true}))),second:()=>publish([...backend.current,{...question,id:'second-question',messageId:'second-message',question:'Which example comes next?'}]),extra:id=>publish([...backend.current,{...question,id,messageId:id+'-message',question:'A distinct question about '+id}]),setOpen:value=>value?setActiveQuestionId(questions[0]?.id):collapseQuestions(thread,questions.map(item=>item.id)),navigate:next=>{history.pushState({},'', '/chat/'+next+location.search);setThread(next);},setWorking,resolve:()=>response.current?.resolve(),accept:()=>response.current?.resolve('accepted'),fail:()=>response.current?.reject(Error('Controlled network failure')),loseConnection:()=>{refreshFails.current=true;response.current?.reject(Error('Controlled network failure'));},failRefresh:()=>{refreshFails.current=true;},allowRefresh:()=>{refreshFails.current=false;},rejectHttp:()=>{http.current=true;},externalResolve:()=>publish(backend.current.map(item=>item.id===question.id?{...item,status:'cancelled'}:item)),addFile:()=>setFiles([new File(['draft attachment'],'practice.txt',{type:'text/plain'})]),deferFocus:id=>focusAfterReveal(()=>document.getElementById(id)),read:()=>({pending,open,draft,working,hidden,thread,activeQuestionId,questions:backend.current,requests:requests.current,refreshes:refreshes.current,writeCount:writeCount.current,recoveries:useQuestionState.getState().recoveries,files:files.length,newJobs:newJobs.current})};});
 const outside=h('button',{id:'outside',className:'chat-mobile-title',type:'button'},'Unrelated control');
 const form=pending?h('div',{hidden:!open},h(DecisionForm,{question:questions[0],action,working,active:open,onResolved:decisionResolved})):null;
 if(decision)return h('main',{ref:decisionRoot,className:'decide'},h('h1',{},'Controlled Decisions state; no agent'),outside,h(QuestionResponseRecoveries,{}),pending?h('article',{'data-decision-id':question.id},h('h2',{'data-decision-focus':'',tabIndex:-1},question.question),form):h(mode==='empty'?'span':'h2',{'data-decision-focus':'',tabIndex:-1,id:'next-decision'},mode==='empty'?'No decisions waiting':'Next decision to review'));
 return h(LazyMotion,{features:domAnimation},h(QuestionDockProvider,{questions,activeQuestionId,onWriteMessage:write,onQuestionResolved:resolved},h(panel.Provider,{value:panel.register},h('main',{className:'chat-panel',...panel.attributes,...(hidden?{'data-has-composer-hidden':''}:{})},h('h1',{},'Controlled question state; no agent or backend'),outside,h(PendingQuestions,{thread,questions,activeQuestionId,setActiveQuestionId,working,action,reduced:true,data:{roles:[{id:'coach',name:'Coach'}]}}),hidden?h('button',{id:'write',type:'button',onClick:write},'Write a message for later'):null,h('div',{id:'composer',className:'chat-compose',ref:composer,hidden,inert:hidden||undefined,tabIndex:-1,'aria-label':'Message composer'},h(ComposerAttachments,{files,removeFile:index=>setFiles(current=>current.filter((_,i)=>i!==index)),disabled:false}),h(ChatComposerEditor,{thread,value:draft,references,inputRef:input,disabled:false,label:'Fixture message',placeholder:'Write a message',suggestions:[],onAction:()=>{},onFiles:()=>{},onSend:()=>{},onChange:(text,refs)=>{setDraft(text);setReferences(refs);}}),h(DropdownMenu,{},h(DropdownMenuTrigger,{id:'add-context'},'Add context'),h(DropdownMenuContent,{},h(DropdownMenuItem,{},'Fixture context action'))))))));
}
createRoot(document.getElementById('root')).render(h(Fixture));
`;
