import type {NextConfig} from 'next';
const assets=['./data/workforce.sqlite.gz','./data/workforce-manifest.json'];
const config:NextConfig={
 images:{unoptimized:true},
 serverExternalPackages:['@azure/data-tables'],
 outputFileTracingIncludes:{'/api/chat':assets,'/api/chat/**':assets,'/api/department':assets,'/api/department/**':assets},
 outputFileTracingExcludes:{'/*':['./.release-local/**/*','./.env*','./.agents/**/*','./.orchestrator/**/*','./data/policies/**/*','./data/*.sqlite']}
};
export default config;
