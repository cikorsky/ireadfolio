import {readFile,readdir,writeFile} from 'node:fs/promises';
import path from 'node:path';
const licenseFile=/^(?:licen[cs]e(?:[._-].*)?|copying(?:[._-].*)?|notice(?:[._-].*)?)$/i;
const selections={dompurify:'Apache-2.0',jszip:'MIT'};
/** Include license text, not only URLs; fail if a new production dependency has no notice. */
export async function writeThirdPartyLicenses(){
 const lock=JSON.parse(await readFile('package-lock.json','utf8'));
 const sections=['Third-party notices for iReadFolio\nGenerated from the locked production dependency tree.\nProject license does not replace the following upstream terms.'];
 for(const [directory,entry]of Object.entries(lock.packages)){
  if(!directory.startsWith('node_modules/')||entry.dev)continue;
  const manifest=JSON.parse(await readFile(path.join(directory,'package.json'),'utf8'));
  const files=(await readdir(directory,{withFileTypes:true})).filter(file=>file.isFile()&&licenseFile.test(file.name)).map(file=>file.name).sort();
  const texts=[];
  for(const name of files)texts.push(`${name}\n${await readFile(path.join(directory,name),'utf8')}`);
  if(!texts.length&&['is-mobile','isarray'].includes(manifest.name)){
   const readme=await readFile(path.join(directory,'README.md'),'utf8');
   const start=readme.search(/^## License\s*$/m);
   if(start>=0)texts.push('README.md license section\n'+readme.slice(start));
  }
  if(!texts.length&&manifest.name==='@ant-design/icons-svg'){
   texts.push('Upstream repository LICENSE\n'+await readFile('licenses/ant-design-icons-svg-LICENSE.txt','utf8'));
  }
  if(!texts.length)throw new Error(`License text missing for ${manifest.name}@${manifest.version}`);
  sections.push(`\n${'='.repeat(72)}\n${manifest.name} ${manifest.version}\nDeclared license: ${manifest.license||'See upstream text'}${selections[manifest.name]?`\nSelected license option: ${selections[manifest.name]}`:''}\n${texts.join('\n\n')}`);
 }
 const output=sections.join('\n').replace(/\r\n/g,'\n').split('\n').map(line=>line.replace(/[ \t]+$/,'')).join('\n').trimEnd()+'\n';
 await writeFile('public/THIRD_PARTY_LICENSES.txt',output);
}
