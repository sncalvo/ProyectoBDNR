import _ from 'lodash';

export type Obj = { [key: string]: any };

export function camelize(obj: Obj) {
  return _.transform(obj, (acc: Obj, value, key, target) => {
    const camelKey = _.isArray(target) ? key : _.camelCase(key);
    
    acc[camelKey] = _.isObject(value) ? camelize(value) : value;
  });
}
