import { prop, getModelForClass } from '@typegoose/typegoose';

class AnalyticsUsers {
  @prop({ required: true }) 
  public firstName!: string;

  @prop({ required: true }) 
  public lastName!: string;

  @prop({ required: true }) 
  public username!: string;

  @prop({ required: true, index: true }) 
  public idTg!: string;

  @prop({ type: Date, default: Date.now })
  public createdAt!: Date;
}

export const AnalyticsUsersModel = getModelForClass(AnalyticsUsers);