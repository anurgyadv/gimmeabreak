import React, {type ReactNode} from 'react';

function inline(text:string):ReactNode[] {
  return text.split(/(\*\*[^*\n]+\*\*)/g).map((part,index)=>
    part.startsWith('**')&&part.endsWith('**')
      ? <strong key={index}>{part.slice(2,-2)}</strong>
      : part
  );
}

/** Small, text-only Markdown subset. Model output is never interpreted as HTML. */
export default function ChatAnswer({text}:{text:string}) {
  const lines=text.replace(/\r\n?/g,'\n').split('\n');
  const blocks:ReactNode[]=[];
  let index=0;
  const bullet=(line:string)=>line.match(/^\s*[-*•]\s+(.+)$/);
  const numbered=(line:string)=>line.match(/^\s*(\d+)[.)]\s+(.+)$/);
  const heading=(line:string)=>line.match(/^\s*#{1,6}\s+(.+)$/);
  const boldHeading=(line:string)=>/^\s*\*\*[^*]+\*\*\s*$/.test(line);
  while(index<lines.length){
    const line=lines[index];
    if(!line.trim()){index++;continue;}
    const title=heading(line);
    if(title){blocks.push(<h4 key={index}>{inline(title[1])}</h4>);index++;continue;}
    const firstBullet=bullet(line),firstNumber=numbered(line);
    if(firstBullet||firstNumber){
      const start=index,items:ReactNode[]=[];
      while(index<lines.length){
        const item=firstBullet?bullet(lines[index]):numbered(lines[index]);
        if(!item)break;
        items.push(<li key={index}>{inline(item[firstBullet?1:2])}</li>);
        index++;
      }
      blocks.push(firstBullet?<ul key={start}>{items}</ul>:<ol key={start} start={Number(firstNumber![1])}>{items}</ol>);
      continue;
    }
    if(boldHeading(line)){blocks.push(<p className="fc-answer-label" key={index}>{inline(line.trim())}</p>);index++;continue;}
    const start=index,paragraph=[line.trim()];index++;
    while(index<lines.length&&lines[index].trim()&&!bullet(lines[index])&&!numbered(lines[index])&&!heading(lines[index])&&!boldHeading(lines[index])){
      paragraph.push(lines[index].trim());index++;
    }
    blocks.push(<p key={start}>{inline(paragraph.join(' '))}</p>);
  }
  return <div className="fc-text fc-answer">{blocks}</div>;
}
