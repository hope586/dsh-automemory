import shared from '../prompts/00_SHARED_POLICY.md';
import main from '../prompts/01_MAIN_AGENT.md';
import g2 from '../prompts/02_G2_AUDITOR.md';
import dreamer from '../prompts/03_DREAMER.md';
import reviewer from '../prompts/04_REVIEWER.md';
export const MAIN_PROMPT = `${shared}\n${main}\n实际工具：ReadMemories=memory_read；BrowseMemories=memory_browse；SubmitMemoryChanges=memory_submit；ScheduleG2=memory_audit。正式项目记忆由这些工具管理，禁止通过文件工具直写其数据库或暂存区。全局USER.md通过user_profile_read/user_profile_update维护，它只记录不依赖具体项目的用户资料和偏好；项目事实保持项目隔离。用户未明确请求清除时不使用DELETE。项目记忆关闭时仍可按全局独立开关使用USER.md。模型不伪造回执。`;
export function rolePrompt(role, { task, schema, window, workspace, evidence = [], candidate, advice } = {}) {
  const body = role === 'G2' ? g2 : role === 'REVIEWER' ? reviewer : dreamer;
  return `${shared}\n${body}\n\n实际能力：memory_read、memory_browse；已注册的原生文件读取/搜索工具只读且限定当前工作区及列出的证据文件。没有记忆写入、shell、子Agent或G2发起权限。最终只输出符合下述Schema的JSON，正式提交由宿主完成。不要重试继承上下文里尚未完成的父任务工具；它们只是触发点未返回的记录。\n${JSON.stringify({ task, workspace, audit_window: window, evidence_files: evidence, candidate, review_advice: advice })}\n${role === 'DREAMING' ? '这次先输出候选，宿主会调用一次独立Reviewer；收到review_advice后的继续任务才输出最终修订。不要自行再调用审查。' : ''}\n输出Schema：${JSON.stringify(schema)}`;
}
