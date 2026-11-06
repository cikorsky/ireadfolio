import type {Server} from 'node:http';
export function createWebDAVTestServer(options?:{username?:string;password?:string;basePath?:string}):{server:Server;files:Map<string,string>;requests:{method:string|undefined;path:string;depth:string|string[]|undefined;authenticated:boolean;ifNoneMatch:string|undefined}[]};
