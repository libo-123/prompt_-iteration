
# 身份信息

Secret Key密钥：sk-lf-7c216c2b-d1dd-4a53-87c0-bca016804f26
Public Key公钥：pk-lf-9a297b3c-f523-4bb3-b962-5d110594d81e
Host：https://langfuse.corp.kuaishou.com


# ts安装
npm install @langfuse/client

import { LangfuseClient } from "@langfuse/client";

const langfuse = new LangfuseClient({
  secretKey: "sk-lf-7c216c2b-d1dd-4a53-87c0-bca016804f26",
  publicKey: "pk-lf-9a297b3c-f523-4bb3-b962-5d110594d81e",
  baseUrl: "https://langfuse.corp.kuaishou.com"
});


open ~/.zshrc   配置
export LANGFUSE_PUBLIC_KEY="pk-lf-9a297b3c-f523-4bb3-b962-5d110594d81e"
export LANGFUSE_SECRET_KEY="sk-lf-7c216c2b-d1dd-4a53-87c0-bca016804f26"
export LANGFUSE_HOST="https://langfuse.corp.kuaishou.com"