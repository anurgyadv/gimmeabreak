import {getSession,securityConfigured} from '@/server/chat-security';
import {modelConfigured} from '@/server/foundry-chat';
import {storageConfigured} from '@/server/chat-store';
import manifest from '@/../data/workforce-manifest.json';
export const runtime='nodejs';export const dynamic='force-dynamic';
export async function GET(req:Request){const session=getSession(req),configured=modelConfigured()&&storageConfigured()&&securityConfigured();return Response.json({configured,authenticated:!!session,accessRequired:!session,role:session?.role||null,model:process.env.FOUNDRY_MODEL||null,database:{rows:manifest.retainedRows,sourceRows:manifest.sourceRows},message:configured?'Connected to Microsoft Foundry and the workforce database.':'Workforce data is loaded. Azure model connection is not configured yet.'},{headers:{'Cache-Control':'no-store'}})}
