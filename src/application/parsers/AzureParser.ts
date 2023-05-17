import { convertDateToUnixTimestamp } from 'chrono-utils';

import { EventDto } from '../../interfaces/Event';
import { Parser, PayloadInput } from '../../interfaces/Parser';

import {
  MissingEventTimeError,
  MissingEventError,
  MissingIdError,
} from '../errors/errors';

/**
 * @description Parser adapted for Azure.
 */
export class AzureParser implements Parser {
  /**
   * @description Azure only handles Incidents, so this simply returns a hard coded value for it.
   */
  public async getEventType(): Promise<string> {
    return 'incident';
  }

  /**
   * @description Get payload fields from the right places.
   */
  public async getPayload(payloadInput: PayloadInput): Promise<EventDto> {
    const body = payloadInput.body || {};

    const event = (() => {
      const eventType = body?.['eventType'];
      if (eventType === 'workitem.created') return 'opened';
      if (eventType === 'workitem.updated') {
        if (
          body?.['resource']?.['revision']?.['fields']?.['System.Reason'] === 'Completed' &&
          body?.['resource']?.['revision']?.['fields']?.['System.Tags']?.includes('incident')
        ) return 'closed';
        if (
          body?.['resource']?.['fields']?.['System.Tags']?.['newValue']?.includes('incident') && 
          !body?.['resource']?.['fields']?.['System.Tags']?.['oldValue']?.includes('incident')
          ) return 'labeled';
        if (
          !body?.['resource']?.['fields']?.['System.Tags']?.['newValue']?.includes('incident') && 
          body?.['resource']?.['fields']?.['System.Tags']?.['oldValue']?.includes('incident')
          ) return 'unlabeled';
      }
      if (eventType === 'workitem.deleted') return 'deleted';
      return eventType;
    })();

    if (!event) throw new MissingEventError();

    switch (event) {
      case 'opened':
      case 'labeled':
        return this.handleOpenedLabeled(body);
      case 'closed':
      case 'unlabeled':
        return this.handleClosedUnlabeled(body);
      case 'deleted':
        return this.handleDeleted(body);
      default:
        return {
          eventTime: 'UNKNOWN',
          timeCreated: 'UNKNOWN',
          id: 'UNKNOWN',
          message: 'UNKNOWN'
        };
    }
  }

  /**
   * @description Utility to create an incident.
   */
  private handleOpenedLabeled(body: Record<string, any>) {
    const timeCreated = body?.['resource']?.['fields']?.['System.CreatedDate'];
    if (!timeCreated)
      throw new MissingEventTimeError('Missing expected timestamp in handleOpenedLabeled()!');

    const id = body?.['resource']?.['id'];
    if (!id) throw new MissingIdError('Missing ID in handleOpenedLabeled()!');

    const title = body?.['resource']?.['fields']?.['System.Title'] || '';

    return {
      eventTime: Date.now().toString(),
      timeCreated: convertDateToUnixTimestamp(timeCreated),
      timeResolved: '',
      id: id.toString(),
      title,
      message: JSON.stringify(body)
    };
  }

  /**
   * @description Utility to resolve an incident.
   */
  private handleClosedUnlabeled(body: Record<string, any>) {
    const timeCreated = body?.['resource']?.['revision']?.['fields']?.['System.CreatedDate'];
    if (!timeCreated)
      throw new MissingEventTimeError('Missing expected timestamp in handleClosedUnlabeled()!');

    const timeResolved = body?.['createdDate'];
    if (!timeResolved)
      throw new MissingEventTimeError(
        'Missing expected updated/resolved timestamp in handleClosedUnlabeled()!'
      );

      const id = body?.['resource']?.['workItemId'];
    if (!id) throw new MissingIdError('Missing ID in handleClosedUnlabeled()!');

    const title = body?.['resource']?.['revision']?.['fields']?.['System.Title'] || '';

    return {
      eventTime: Date.now().toString(),
      timeCreated: convertDateToUnixTimestamp(timeCreated),
      timeResolved: convertDateToUnixTimestamp(timeResolved),
      id: id.toString(),
      title,
      message: JSON.stringify(body)
    };
  }

  private handleDeleted(body: Record<string, any>) {
    const timeCreated = body?.['resource']?.['fields']?.['System.CreatedDate'];
    if (!timeCreated)
      throw new MissingEventTimeError('Missing expected timestamp in handleClosedUnlabeled()!');

    const timeResolved = body?.['createdDate'];
    if (!timeResolved)
      throw new MissingEventTimeError(
        'Missing expected updated/resolved timestamp in handleClosedUnlabeled()!'
      );

      const id = body?.['resource']?.['id'];
    if (!id) throw new MissingIdError('Missing ID in handleClosedUnlabeled()!');

    const title = body?.['resource']?.['fields']?.['System.Title'] || '';

    return {
      eventTime: Date.now().toString(),
      timeCreated: convertDateToUnixTimestamp(timeCreated),
      timeResolved: convertDateToUnixTimestamp(timeResolved),
      id: id.toString(),
      title,
      message: JSON.stringify(body)
    };
  }

  /**
   * @description Get the repository name.
   * @example `https://bitbucket.org/SOMEORG/SOMEREPO/src/master/`
   * @example `https://bitbucket.org/SOMEORG/SOMEREPO/`
   * @example `https://github.com/SOMEORG/SOMEREPO`
   */
  public getRepoName(body: Record<string, any>): string {
    if(body?.['resource']?.['revision']?.['fields'] !== undefined){
      const areaPath = body?.['resource']?.['revision']?.['fields']?.['System.AreaPath'];

      if(body?.['resource']?.['revision']?.['fields']?.['System.Tags']?.includes('intocare')){
        return areaPath.concat('/intocare');
      }
      if(body?.['resource']?.['revision']?.['fields']?.['System.Tags']?.includes('portal')){
        return areaPath.concat('/portal');
      }
      return areaPath;
  }else{
    const areaPath = body?.['resource']?.['fields']?.['System.AreaPath'];

    if(body?.['resource']?.['fields']?.['System.Tags']?.includes('intocare')){
      return areaPath.concat('/intocare');
    }
    if(body?.['resource']?.['fields']?.['System.Tags']?.includes('portal')){
      return areaPath.concat('/portal');
    }
    return areaPath;
  }
  }
}
