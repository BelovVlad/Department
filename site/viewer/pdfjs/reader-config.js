// What makes this copy of the shared PDF reader belong to the Department site. The reader is
// maintained in NSU Y4 S1 (site/web/pdfjs) and copied here by its site/scripts/sync_reader.py.
export default {
  repo:{owner:'BelovVlad',name:'Department',branch:'main'},
  defaultTitle:'Документ',
  titleSuffix:' · Кафедра',
  backUrl:subject=>'../../'+(subject?'#s-'+encodeURIComponent(subject):''),
};
