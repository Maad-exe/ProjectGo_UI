import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
  name: 'filter',
  standalone: true
})
export class FilterPipe implements PipeTransform {
  transform(items: any[], filterObj: any): any[] {
    if (!items) return [];
    if (!filterObj) return items;
    
    return items.filter(item => {
      for (let key in filterObj) {
        if (item[key] !== filterObj[key]) return false;
      }
      return true;
    });
  }
}