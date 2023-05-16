import { convertDateToUnixTimestamp } from 'chrono-utils';

import { EventDto } from '../../interfaces/Event';
import { Parser, EventTypeInput, PayloadInput } from '../../interfaces/Parser';
import {
  UnknownEventTypeError,
  MissingEventTimeError,
  MissingEventError,
  MissingIdError
} from '../errors/errors';

/**
 * @description Parser adapted for GitHub.
 */
export class GitHubParser implements Parser {
  /**
   * @description Normalize the incoming event into one of the three
   * supported types: `change`, `deployment`, or `incident`
   */
  // @ts-ignore
  public async getEventType(eventTypeInput: EventTypeInput): Promise<string> {
    const { headers } = eventTypeInput;
    const eventType = headers?.['X-GitHub-Event'] || headers?.['x-github-event'];

    if (eventType === 'pull_request') return 'change';
    if (eventType === 'issues') return 'incident';

    throw new UnknownEventTypeError();
  }

  /**
   * @description Get payload fields from the right places.
   */
  public async getPayload(payloadInput: PayloadInput): Promise<EventDto> {
    const { headers } = payloadInput;
    const body = payloadInput.body || {};

    const event = (() => {
      if(body?.action === 'closed') return body.action;
      return headers?.['X-GitHub-Event'] || headers?.['x-github-event'];
    })();
    if (!event) throw new MissingEventError();

    switch (event) {
      case 'pull_request':
        return this.handlePullRequest(body);
      case 'closed':
        return this.handlePullRequest(body);
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
   * @description Utility to create a change
   */
  private handlePullRequest(body: Record<string, any>) {
    if(!body?.['pull_request']?.['merged']){
      return {
        eventTime: 'UNKNOWN',
        timeCreated: 'UNKNOWN',
        id: 'UNKNOWN',
        message: 'UNKNOWN'
      };
    }

    const timeCreated = body?.['pull_request']?.['merged_at'];
    if (!timeCreated)
      throw new MissingEventTimeError('Missing expected timestamp in handlePush()!');
    const id = body?.['pull_request']?.['merge_commit_sha'];
    if (!id) throw new MissingIdError('Missing ID in handlePush()!');

    return {
      eventTime: Date.now().toString(),
      timeCreated: convertDateToUnixTimestamp(timeCreated),
      id: id.toString(),
      message: JSON.stringify(body)
    };
  }

  /**
   * @description Get the repository name.
   */
  public getRepoName(body: Record<string, any>): string {
    return (body && body?.['repository']?.['full_name']) || '';
  }
}
