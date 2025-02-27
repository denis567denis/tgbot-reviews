import { prop, getModelForClass } from '@typegoose/typegoose';

class Analytics {
  @prop({ required: true, index: true }) 
  public authorName!: string;

  @prop({ required: true })
  public postCount!: number;
}

export const AnalyticsModel = getModelForClass(Analytics);